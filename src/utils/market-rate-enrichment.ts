import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { fetchMorphoMarketRateEnrichments, getMorphoMarketRateFieldsKey } from '@/data-sources/morpho-api/market-rate-fields';
import { AdaptiveCurveIrmLib, MarketUtils, MathLib, SharesMath } from '@morpho-org/blue-sdk';
import type { Address } from 'viem';
import { morphoIrmAbi } from '@/abis/morpho-irm';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { fetchBlocksWithTimestamps } from '@/utils/blockEstimation';
import { supportsHistoricalStateRead, type SupportedNetworks } from '@/utils/networks';
import { fetchMarketsSnapshots, type MarketSnapshot } from '@/utils/positions';
import { computeAnnualizedApyFromGrowth } from '@/utils/rateMath';
import { getClient } from '@/utils/rpc';
import type { Market } from '@/utils/types';

const SECONDS_PER_DAY = 24 * 60 * 60;
const BORROW_RATE_BATCH_SIZE = 100;
const BORROW_RATE_PARALLEL_BATCHES = 2;
const MARKET_RATE_RPC_FALLBACK_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MARKET_RATE_RPC_FALLBACK?.trim().toLowerCase() !== 'false';

const LOOKBACK_WINDOWS = [
  {
    seconds: SECONDS_PER_DAY,
    supplyField: 'dailySupplyApy',
    borrowField: 'dailyBorrowApy',
  },
  {
    seconds: 7 * SECONDS_PER_DAY,
    supplyField: 'weeklySupplyApy',
    borrowField: 'weeklyBorrowApy',
  },
  {
    seconds: 30 * SECONDS_PER_DAY,
    supplyField: 'monthlySupplyApy',
    borrowField: 'monthlyBorrowApy',
  },
] as const;

export type RateEnrichmentMarketInput = Pick<Market, 'uniqueKey' | 'lltv' | 'irmAddress' | 'oracleAddress'> & {
  loanAsset: Pick<Market['loanAsset'], 'address'>;
  collateralAsset: Pick<Market['collateralAsset'], 'address'>;
  morphoBlue: {
    chain: {
      id: number;
    };
  };
};

type BoundaryState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  timestamp: number;
};

export type WindowRealizedRates = {
  supplyApy: number | null;
  borrowApy: number | null;
};

type MarketWindowRates = Map<number, WindowRealizedRates>;

export type MarketWindowRatesMap = Map<string, MarketWindowRates>;

export type MarketRateEnrichment = Pick<
  Market['state'],
  | 'apyAtTarget'
  | 'rateAtTarget'
  | 'dailySupplyApy'
  | 'dailyBorrowApy'
  | 'weeklySupplyApy'
  | 'weeklyBorrowApy'
  | 'monthlySupplyApy'
  | 'monthlyBorrowApy'
>;

export type MarketRateEnrichmentMap = Map<string, MarketRateEnrichment>;
export const ROLLING_RATE_WINDOW_SECONDS = LOOKBACK_WINDOWS.map((window) => window.seconds);

export type HistoricalMarketBoundaryState = {
  timestamp: number;
  targetTimestamp: number;
  blockNumber: number;
  supplyApy: number;
  borrowApy: number;
  apyAtTarget: number;
  utilization: number;
  supplyAssets: bigint;
  borrowAssets: bigint;
  liquidityAssets: bigint;
};

const buildEmptyEnrichment = (): MarketRateEnrichment => ({
  apyAtTarget: 0,
  rateAtTarget: '0',
  dailySupplyApy: null,
  dailyBorrowApy: null,
  weeklySupplyApy: null,
  weeklyBorrowApy: null,
  monthlySupplyApy: null,
  monthlyBorrowApy: null,
});

const buildEmptyWindowRates = (windowSeconds: number[]): MarketWindowRates =>
  new Map(windowSeconds.map((seconds) => [seconds, { supplyApy: null, borrowApy: null }]));

const toBigInt = (value: string | number | bigint): bigint => BigInt(value);

const deriveRateAtTargetFromBorrowRate = (borrowRate: bigint, utilization: bigint): bigint => {
  if (borrowRate <= 0n) {
    return 0n;
  }

  const targetUtilization = AdaptiveCurveIrmLib.TARGET_UTILIZATION;
  const errNormFactor = utilization > targetUtilization ? MathLib.WAD - targetUtilization : targetUtilization;
  if (errNormFactor <= 0n) {
    return 0n;
  }

  const err = MathLib.wDivDown(utilization - targetUtilization, errNormFactor);
  const coeff =
    err < 0n
      ? MathLib.WAD - MathLib.wDivDown(MathLib.WAD, AdaptiveCurveIrmLib.CURVE_STEEPNESS)
      : AdaptiveCurveIrmLib.CURVE_STEEPNESS - MathLib.WAD;
  const factor = MathLib.wMulDown(coeff, err) + MathLib.WAD;

  if (factor <= 0n) {
    return 0n;
  }

  return MathLib.wDivDown(borrowRate, factor);
};

export const getWindowRatesFromEnrichment = (enrichment: MarketRateEnrichment | undefined, windowSeconds: number): WindowRealizedRates => {
  if (!enrichment) {
    return { supplyApy: null, borrowApy: null };
  }

  switch (windowSeconds) {
    case LOOKBACK_WINDOWS[0].seconds:
      return {
        supplyApy: enrichment.dailySupplyApy,
        borrowApy: enrichment.dailyBorrowApy,
      };
    case LOOKBACK_WINDOWS[1].seconds:
      return {
        supplyApy: enrichment.weeklySupplyApy,
        borrowApy: enrichment.weeklyBorrowApy,
      };
    case LOOKBACK_WINDOWS[2].seconds:
      return {
        supplyApy: enrichment.monthlySupplyApy,
        borrowApy: enrichment.monthlyBorrowApy,
      };
    default:
      return { supplyApy: null, borrowApy: null };
  }
};

const isUninitializedSnapshot = (snapshot: MarketSnapshot): boolean =>
  snapshot.lastUpdate === 0 &&
  snapshot.totalSupplyAssets === '0' &&
  snapshot.totalSupplyShares === '0' &&
  snapshot.totalBorrowAssets === '0' &&
  snapshot.totalBorrowShares === '0';

const accrueSnapshotToTimestamp = (snapshot: MarketSnapshot, avgBorrowRate: bigint, boundaryTimestamp: number): BoundaryState | null => {
  if (!Number.isFinite(boundaryTimestamp) || boundaryTimestamp < snapshot.lastUpdate) {
    return null;
  }

  const totalSupplyAssets = toBigInt(snapshot.totalSupplyAssets);
  const totalSupplyShares = toBigInt(snapshot.totalSupplyShares);
  const totalBorrowAssets = toBigInt(snapshot.totalBorrowAssets);
  const totalBorrowShares = toBigInt(snapshot.totalBorrowShares);
  const fee = toBigInt(snapshot.fee);
  const elapsed = BigInt(Math.max(0, boundaryTimestamp - snapshot.lastUpdate));
  const { interest, feeShares } = MarketUtils.getAccruedInterest(
    avgBorrowRate,
    {
      totalSupplyAssets,
      totalBorrowAssets,
      totalSupplyShares,
      fee,
    },
    elapsed,
  );

  return {
    totalSupplyAssets: totalSupplyAssets + interest,
    totalSupplyShares: totalSupplyShares + feeShares,
    totalBorrowAssets: totalBorrowAssets + interest,
    totalBorrowShares,
    timestamp: boundaryTimestamp,
  };
};

const computeRealizedApyFromSharePriceGrowth = ({
  startAssets,
  startShares,
  endAssets,
  endShares,
  periodSeconds,
}: {
  startAssets: bigint;
  startShares: bigint;
  endAssets: bigint;
  endShares: bigint;
  periodSeconds: number;
}): number | null =>
  computeAnnualizedApyFromGrowth({
    currentValue: (endAssets + SharesMath.VIRTUAL_ASSETS) * (startShares + SharesMath.VIRTUAL_SHARES),
    pastValue: (startAssets + SharesMath.VIRTUAL_ASSETS) * (endShares + SharesMath.VIRTUAL_SHARES),
    periodSeconds,
  });

const computeWindowRates = (startState: BoundaryState, endState: BoundaryState): WindowRealizedRates => {
  const periodSeconds = endState.timestamp - startState.timestamp;
  if (periodSeconds <= 0) {
    return { supplyApy: null, borrowApy: null };
  }

  return {
    supplyApy: computeRealizedApyFromSharePriceGrowth({
      startAssets: startState.totalSupplyAssets,
      startShares: startState.totalSupplyShares,
      endAssets: endState.totalSupplyAssets,
      endShares: endState.totalSupplyShares,
      periodSeconds,
    }),
    borrowApy: computeRealizedApyFromSharePriceGrowth({
      startAssets: startState.totalBorrowAssets,
      startShares: startState.totalBorrowShares,
      endAssets: endState.totalBorrowAssets,
      endShares: endState.totalBorrowShares,
      periodSeconds,
    }),
  };
};

const buildApiEnrichmentFromMarket = (market: Market): MarketRateEnrichment => ({
  apyAtTarget: market.state.apyAtTarget,
  rateAtTarget: market.state.rateAtTarget,
  dailySupplyApy: market.state.dailySupplyApy ?? null,
  dailyBorrowApy: market.state.dailyBorrowApy ?? null,
  weeklySupplyApy: market.state.weeklySupplyApy ?? null,
  weeklyBorrowApy: market.state.weeklyBorrowApy ?? null,
  monthlySupplyApy: market.state.monthlySupplyApy ?? null,
  monthlyBorrowApy: market.state.monthlyBorrowApy ?? null,
});

type MorphoRateFetchResult = {
  enrichments: Map<string, MarketRateEnrichment>;
  failed: boolean;
};

const fetchMorphoRateMarketsByKey = async (
  chainMarkets: RateEnrichmentMarketInput[],
  chainId: SupportedNetworks,
): Promise<MorphoRateFetchResult> => {
  if (!supportsMorphoApi(chainId)) {
    return {
      enrichments: new Map(),
      failed: false,
    };
  }

  try {
    if (chainMarkets.length === 1) {
      const morphoMarket = await fetchMorphoMarket(chainMarkets[0].uniqueKey, chainId);
      if (!morphoMarket) {
        return {
          enrichments: new Map(),
          failed: false,
        };
      }

      return {
        enrichments: new Map([[getMarketRateEnrichmentKey(morphoMarket.uniqueKey, chainId), buildApiEnrichmentFromMarket(morphoMarket)]]),
        failed: false,
      };
    }
    const morphoEnrichments = await fetchMorphoMarketRateEnrichments(chainId);
    return {
      enrichments: chainMarkets.reduce((acc, market) => {
        const enrichment = morphoEnrichments.get(getMorphoMarketRateFieldsKey(chainId, market.uniqueKey));
        if (!enrichment) {
          return acc;
        }

        acc.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), enrichment);
        return acc;
      }, new Map<string, MarketRateEnrichment>()),
      failed: false,
    };
  } catch (error) {
    console.warn(`[market-rate-enrichment] Failed to fetch Morpho rolling rates for chain ${chainId}:`, error);
    return {
      enrichments: new Map(),
      failed: true,
    };
  }
};

const fetchBoundaryBorrowRates = async (
  markets: RateEnrichmentMarketInput[],
  chainId: SupportedNetworks,
  snapshots: Map<string, MarketSnapshot>,
  client: ReturnType<typeof getClient>,
  blockNumber: number,
): Promise<Map<string, bigint>> => {
  const marketContracts = markets
    .map((market) => {
      const snapshot = snapshots.get(market.uniqueKey.toLowerCase());
      if (!snapshot || isUninitializedSnapshot(snapshot)) {
        return null;
      }

      return {
        marketKey: market.uniqueKey.toLowerCase(),
        contract: {
          address: market.irmAddress as Address,
          abi: morphoIrmAbi,
          functionName: 'borrowRateView' as const,
          args: [
            {
              loanToken: market.loanAsset.address as Address,
              collateralToken: market.collateralAsset.address as Address,
              oracle: market.oracleAddress as Address,
              irm: market.irmAddress as Address,
              lltv: BigInt(market.lltv),
            },
            {
              totalSupplyAssets: toBigInt(snapshot.totalSupplyAssets),
              totalSupplyShares: toBigInt(snapshot.totalSupplyShares),
              totalBorrowAssets: toBigInt(snapshot.totalBorrowAssets),
              totalBorrowShares: toBigInt(snapshot.totalBorrowShares),
              lastUpdate: BigInt(snapshot.lastUpdate),
              fee: toBigInt(snapshot.fee),
            },
          ],
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const borrowRates = new Map<string, bigint>();
  if (marketContracts.length === 0) {
    return borrowRates;
  }

  for (let waveStart = 0; waveStart < marketContracts.length; waveStart += BORROW_RATE_BATCH_SIZE * BORROW_RATE_PARALLEL_BATCHES) {
    const waveChunks: (typeof marketContracts)[] = [];

    for (let chunkIndex = 0; chunkIndex < BORROW_RATE_PARALLEL_BATCHES; chunkIndex += 1) {
      const chunkStart = waveStart + chunkIndex * BORROW_RATE_BATCH_SIZE;
      if (chunkStart >= marketContracts.length) {
        break;
      }

      waveChunks.push(marketContracts.slice(chunkStart, chunkStart + BORROW_RATE_BATCH_SIZE));
    }

    const waveResults = await Promise.all(
      waveChunks.map((marketChunk) =>
        client.multicall({
          contracts: marketChunk.map((entry) => entry.contract),
          allowFailure: true,
          blockNumber: BigInt(blockNumber),
        }),
      ),
    );

    waveResults.forEach((results, waveIndex) => {
      const marketChunk = waveChunks[waveIndex] ?? [];

      results.forEach((result, resultIndex) => {
        if (result.status !== 'success' || result.result == null) {
          return;
        }

        const marketKey = marketChunk[resultIndex]?.marketKey;
        if (!marketKey) {
          return;
        }

        borrowRates.set(marketKey, result.result);
      });
    });
  }

  return borrowRates;
};

const fetchBoundaryStatesAtBlock = async (
  markets: RateEnrichmentMarketInput[],
  chainId: SupportedNetworks,
  client: ReturnType<typeof getClient>,
  blockNumber: number,
  blockTimestamp: number,
): Promise<Map<string, BoundaryState>> => {
  const snapshots = await fetchMarketsSnapshots(
    markets.map((market) => market.uniqueKey),
    chainId,
    client,
    blockNumber,
  );
  const borrowRates = await fetchBoundaryBorrowRates(markets, chainId, snapshots, client, blockNumber);
  const boundaryStates = new Map<string, BoundaryState>();

  markets.forEach((market) => {
    const marketKey = market.uniqueKey.toLowerCase();
    const snapshot = snapshots.get(marketKey);
    const borrowRate = borrowRates.get(marketKey);

    if (!snapshot || borrowRate == null || isUninitializedSnapshot(snapshot)) {
      return;
    }

    const accruedState = accrueSnapshotToTimestamp(snapshot, borrowRate, blockTimestamp);
    if (!accruedState) {
      return;
    }

    boundaryStates.set(marketKey, accruedState);
  });

  return boundaryStates;
};

export const getMarketRateEnrichmentKey = (marketId: string, chainId: number): string => `${chainId}-${marketId.toLowerCase()}`;

export async function fetchRealizedMarketWindowRates(
  markets: RateEnrichmentMarketInput[],
  requestedWindows: number[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<MarketWindowRatesMap> {
  const marketWindowRates = new Map<string, MarketWindowRates>();

  if (markets.length === 0 || requestedWindows.length === 0) {
    return marketWindowRates;
  }

  const uniqueWindows = Array.from(new Set(requestedWindows.filter((window) => window > 0))).sort((left, right) => left - right);
  if (uniqueWindows.length === 0) {
    return marketWindowRates;
  }

  const marketsByChain = markets.reduce(
    (acc, market) => {
      const chainId = market.morphoBlue.chain.id as SupportedNetworks;
      const chainMarkets = acc[chainId] ?? [];
      chainMarkets.push(market);
      acc[chainId] = chainMarkets;
      return acc;
    },
    {} as Record<SupportedNetworks, RateEnrichmentMarketInput[]>,
  );

  await Promise.all(
    Object.entries(marketsByChain).map(async ([chainIdValue, chainMarkets]) => {
      const chainId = Number(chainIdValue) as SupportedNetworks;
      chainMarkets.forEach((market) => {
        marketWindowRates.set(getMarketRateEnrichmentKey(market.uniqueKey, chainId), buildEmptyWindowRates(uniqueWindows));
      });

      if (!supportsHistoricalStateRead(chainId)) {
        return;
      }

      const client = getClient(chainId, customRpcUrls[chainId]);

      try {
        const latestBlockNumber = Number(await client.getBlockNumber());
        const latestBlock = await client.getBlock({ blockNumber: BigInt(latestBlockNumber) });
        const latestTimestamp = Number(latestBlock.timestamp);
        const boundaryBlocks = await fetchBlocksWithTimestamps(
          client,
          chainId,
          uniqueWindows.map((window) => latestTimestamp - window),
          latestBlockNumber,
          latestTimestamp,
        );

        const boundaryStatesByWindow = new Map<number, Map<string, BoundaryState>>();
        const latestBoundaryStates = await fetchBoundaryStatesAtBlock(chainMarkets, chainId, client, latestBlockNumber, latestTimestamp);

        await Promise.all(
          boundaryBlocks.map(async (boundary) => {
            const windowSeconds = latestTimestamp - boundary.targetTimestamp;
            const boundaryStates = await fetchBoundaryStatesAtBlock(
              chainMarkets,
              chainId,
              client,
              boundary.blockNumber,
              boundary.timestamp,
            );
            boundaryStatesByWindow.set(windowSeconds, boundaryStates);
          }),
        );

        chainMarkets.forEach((market) => {
          const marketKey = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
          const marketRates = marketWindowRates.get(marketKey);
          const latestState = latestBoundaryStates.get(market.uniqueKey.toLowerCase());

          if (!marketRates || !latestState) {
            return;
          }

          uniqueWindows.forEach((windowSeconds) => {
            const startState = boundaryStatesByWindow.get(windowSeconds)?.get(market.uniqueKey.toLowerCase());
            if (!startState) {
              return;
            }

            marketRates.set(windowSeconds, computeWindowRates(startState, latestState));
          });
        });
      } catch (error) {
        console.warn(`[market-rate-enrichment] Failed to calculate realized rates for chain ${chainId}:`, error);
      }
    }),
  );

  return marketWindowRates;
}

export async function fetchHistoricalMarketBoundaryState(
  market: RateEnrichmentMarketInput,
  targetTimestamp: number,
  customRpcUrls: CustomRpcUrls = {},
): Promise<HistoricalMarketBoundaryState | null> {
  const [boundaryState] = await fetchHistoricalMarketBoundaryStates(market, [targetTimestamp], customRpcUrls);
  return boundaryState ?? null;
}

export async function fetchHistoricalMarketBoundaryStates(
  market: RateEnrichmentMarketInput,
  targetTimestamps: number[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<HistoricalMarketBoundaryState[]> {
  const uniqueTargetTimestamps = Array.from(
    new Set(targetTimestamps.filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0)),
  ).sort((left, right) => left - right);

  if (uniqueTargetTimestamps.length === 0) {
    return [];
  }

  const chainId = market.morphoBlue.chain.id as SupportedNetworks;
  if (!supportsHistoricalStateRead(chainId)) {
    return [];
  }

  const client = getClient(chainId, customRpcUrls[chainId]);

  try {
    const latestBlockNumber = Number(await client.getBlockNumber());
    const latestBlock = await client.getBlock({ blockNumber: BigInt(latestBlockNumber) });
    const latestTimestamp = Number(latestBlock.timestamp);
    const boundaryBlocks = await fetchBlocksWithTimestamps(client, chainId, uniqueTargetTimestamps, latestBlockNumber, latestTimestamp);
    const boundaryStates: HistoricalMarketBoundaryState[] = [];

    for (const boundaryBlock of boundaryBlocks) {
      const snapshots = await fetchMarketsSnapshots([market.uniqueKey], chainId, client, boundaryBlock.blockNumber);
      const snapshot = snapshots.get(market.uniqueKey.toLowerCase());
      if (!snapshot || isUninitializedSnapshot(snapshot)) {
        continue;
      }

      const borrowRates = await fetchBoundaryBorrowRates([market], chainId, snapshots, client, boundaryBlock.blockNumber);
      const borrowRate = borrowRates.get(market.uniqueKey.toLowerCase());
      if (borrowRate == null) {
        continue;
      }

      const accruedState = accrueSnapshotToTimestamp(snapshot, borrowRate, boundaryBlock.timestamp);
      if (!accruedState) {
        continue;
      }

      const utilizationWad = MarketUtils.getUtilization({
        totalSupplyAssets: accruedState.totalSupplyAssets,
        totalBorrowAssets: accruedState.totalBorrowAssets,
      });
      const supplyRate = MathLib.wMulUp(MathLib.wMulDown(borrowRate, utilizationWad), MathLib.WAD - toBigInt(snapshot.fee));
      const rateAtTarget = deriveRateAtTargetFromBorrowRate(borrowRate, utilizationWad);

      boundaryStates.push({
        timestamp: boundaryBlock.timestamp,
        targetTimestamp: boundaryBlock.targetTimestamp,
        blockNumber: boundaryBlock.blockNumber,
        supplyApy: MarketUtils.rateToApy(supplyRate),
        borrowApy: MarketUtils.rateToApy(borrowRate),
        apyAtTarget: MarketUtils.rateToApy(rateAtTarget),
        utilization: Number(utilizationWad) / 1e18,
        supplyAssets: accruedState.totalSupplyAssets,
        borrowAssets: accruedState.totalBorrowAssets,
        liquidityAssets: accruedState.totalSupplyAssets - accruedState.totalBorrowAssets,
      });
    }

    return boundaryStates;
  } catch (error) {
    console.warn(`[market-rate-enrichment] Failed to fetch boundary states for market ${market.uniqueKey} on chain ${chainId}:`, error);
    return [];
  }
}

export async function fetchMarketRateEnrichment(
  markets: RateEnrichmentMarketInput[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<MarketRateEnrichmentMap> {
  const enrichments = new Map<string, MarketRateEnrichment>();

  if (markets.length === 0) {
    return enrichments;
  }

  const marketsByChain = markets.reduce((acc, market) => {
    const chainId = market.morphoBlue.chain.id as SupportedNetworks;
    const chainMarkets = acc.get(chainId) ?? [];
    chainMarkets.push(market);
    acc.set(chainId, chainMarkets);
    return acc;
  }, new Map<SupportedNetworks, RateEnrichmentMarketInput[]>());

  for (const [chainId, chainMarkets] of marketsByChain.entries()) {
    const { enrichments: morphoEnrichmentsByKey, failed: morphoRateFetchFailed } = await fetchMorphoRateMarketsByKey(chainMarkets, chainId);

    chainMarkets.forEach((market) => {
      const key = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
      const morphoEnrichment = morphoEnrichmentsByKey.get(key) ?? buildEmptyEnrichment();
      enrichments.set(key, morphoEnrichment);
    });

    if (morphoRateFetchFailed && MARKET_RATE_RPC_FALLBACK_ENABLED) {
      const windowRates = await fetchRealizedMarketWindowRates(
        chainMarkets,
        LOOKBACK_WINDOWS.map((window) => window.seconds),
        customRpcUrls,
      );

      chainMarkets.forEach((market) => {
        const key = getMarketRateEnrichmentKey(market.uniqueKey, chainId);
        const ratesByWindow = windowRates.get(key);

        if (!ratesByWindow) {
          return;
        }

        const fallbackEnrichment = LOOKBACK_WINDOWS.reduce<MarketRateEnrichment>((acc, window) => {
          const windowRatesEntry = ratesByWindow.get(window.seconds);
          acc[window.supplyField] = windowRatesEntry?.supplyApy ?? null;
          acc[window.borrowField] = windowRatesEntry?.borrowApy ?? null;
          return acc;
        }, buildEmptyEnrichment());

        enrichments.set(key, {
          ...enrichments.get(key),
          ...fallbackEnrichment,
        });
      });
    }
  }

  return enrichments;
}
