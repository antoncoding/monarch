import { AdaptiveCurveIrmLib, Market as BlueMarket, MarketParams as BlueMarketParams, MarketUtils } from '@morpho-org/blue-sdk';
import { type Address, formatUnits } from 'viem';
import morphoAbi from '@/abis/morpho';
import { fetchMarketDetails } from '@/data-sources/market-details';
import type { HistoricalDataSuccessResult } from '@/data-sources/morpho-api/historical';
import { fetchEnvioBorrowRateUpdates, fetchLatestEnvioBorrowRateUpdateBefore } from '@/data-sources/envio/events';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import type { BlockWithTimestamp } from '@/utils/blockEstimation';
import { getMorphoAddress } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import type { MarketRates, MarketVolumes, TimeseriesDataPoint, TimeseriesOptions } from '@/utils/types';
import { fetchHistoricalChainContext } from '../shared/historical-chain-context';
import { normalizeEnvioString, normalizeEnvioTimestamp } from './utils';

const INTERVAL_SECONDS: Record<TimeseriesOptions['interval'], number> = {
  DAY: 24 * 60 * 60,
  HOUR: 60 * 60,
  MONTH: 30 * 24 * 60 * 60,
  WEEK: 7 * 24 * 60 * 60,
};
const HISTORICAL_STATE_BATCH_SIZE = 24;
const HISTORICAL_TIMEOUT_MS = 12_000;

type HistoricalMarketState = {
  fee: bigint;
  lastUpdate: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = globalThis.setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
};

const toNumberValue = (value: bigint, decimals: number): number => {
  const formattedValue = formatUnits(value, decimals);
  const parsedValue = Number(formattedValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const tryParseBigInt = (value: string): bigint | null => {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const buildTimestamps = ({ endTimestamp, interval, startTimestamp }: TimeseriesOptions): number[] => {
  const stepSeconds = INTERVAL_SECONDS[interval];
  const timestamps: number[] = [];

  for (let timestamp = startTimestamp; timestamp <= endTimestamp; timestamp += stepSeconds) {
    timestamps.push(timestamp);
  }

  if (timestamps.at(-1) !== endTimestamp) {
    timestamps.push(endTimestamp);
  }

  return timestamps;
};

const parseHistoricalMarketState = (value: unknown): HistoricalMarketState | null => {
  if (!Array.isArray(value) || value.length < 6 || !value.every((entry) => typeof entry === 'bigint')) {
    return null;
  }

  return {
    fee: value[5] as bigint,
    lastUpdate: value[4] as bigint,
    totalBorrowAssets: value[2] as bigint,
    totalBorrowShares: value[3] as bigint,
    totalSupplyAssets: value[0] as bigint,
    totalSupplyShares: value[1] as bigint,
  };
};

const normalizeRateAtTarget = (value: string): bigint => {
  try {
    const parsedValue = BigInt(value);
    return parsedValue > 0n ? parsedValue : AdaptiveCurveIrmLib.INITIAL_RATE_AT_TARGET;
  } catch {
    return AdaptiveCurveIrmLib.INITIAL_RATE_AT_TARGET;
  }
};

const deriveLoanAssetPrice = (market: NonNullable<Awaited<ReturnType<typeof fetchMarketDetails>>>): number => {
  const parsedSupplyAssets = tryParseBigInt(market.state.supplyAssets);
  const supplyAssets = parsedSupplyAssets ? toNumberValue(parsedSupplyAssets, market.loanAsset.decimals) : 0;
  if (supplyAssets > 0 && market.state.supplyAssetsUsd > 0) {
    return market.state.supplyAssetsUsd / supplyAssets;
  }

  const parsedBorrowAssets = tryParseBigInt(market.state.borrowAssets);
  const borrowAssets = parsedBorrowAssets ? toNumberValue(parsedBorrowAssets, market.loanAsset.decimals) : 0;
  if (borrowAssets > 0 && market.state.borrowAssetsUsd > 0) {
    return market.state.borrowAssetsUsd / borrowAssets;
  }

  return 0;
};

const buildEmptyResult = (): HistoricalDataSuccessResult => ({
  rates: {
    apyAtTarget: [],
    borrowApy: [],
    supplyApy: [],
    utilization: [],
  },
  volumes: {
    borrowAssets: [],
    borrowAssetsUsd: [],
    liquidityAssets: [],
    liquidityAssetsUsd: [],
    supplyAssets: [],
    supplyAssetsUsd: [],
  },
});

const addPoint = (series: TimeseriesDataPoint[], x: number, y: number) => {
  if (Number.isFinite(y)) {
    series.push({ x, y });
  }
};

const fetchHistoricalStates = async ({
  blocks,
  chainId,
  marketId,
  customRpcUrl,
}: {
  blocks: BlockWithTimestamp[];
  chainId: SupportedNetworks;
  marketId: string;
  customRpcUrl?: string;
}): Promise<{ state: HistoricalMarketState; timestamp: number }[]> => {
  const client = getClient(chainId, customRpcUrl);
  const morphoAddress = getMorphoAddress(chainId) as Address;
  const historicalStates: { state: HistoricalMarketState; timestamp: number }[] = [];

  for (let index = 0; index < blocks.length; index += HISTORICAL_STATE_BATCH_SIZE) {
    const blockBatch = blocks.slice(index, index + HISTORICAL_STATE_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      blockBatch.map(async (block) =>
        withTimeout(
          client.readContract({
            abi: morphoAbi,
            address: morphoAddress,
            args: [marketId as `0x${string}`],
            blockNumber: BigInt(block.blockNumber),
            functionName: 'market' as const,
          }),
          HISTORICAL_TIMEOUT_MS,
          null,
        ),
      ),
    );

    for (const [batchIndex, result] of batchResults.entries()) {
      if (result.status !== 'fulfilled' || result.value == null) {
        continue;
      }

      const parsedState = parseHistoricalMarketState(result.value);
      if (!parsedState) {
        continue;
      }

      historicalStates.push({
        state: parsedState,
        timestamp: blockBatch[batchIndex]!.timestamp,
      });
    }
  }

  return historicalStates.sort((left, right) => left.timestamp - right.timestamp);
};

const buildHistoricalResult = ({
  historicalStates,
  loanAssetDecimals,
  loanAssetPrice,
  market,
  rateUpdates,
  seedRateAtTarget,
}: {
  historicalStates: { state: HistoricalMarketState; timestamp: number }[];
  loanAssetDecimals: number;
  loanAssetPrice: number;
  market: NonNullable<Awaited<ReturnType<typeof fetchMarketDetails>>>;
  rateUpdates: Awaited<ReturnType<typeof fetchEnvioBorrowRateUpdates>>;
  seedRateAtTarget: bigint;
}): HistoricalDataSuccessResult => {
  const result = buildEmptyResult();
  const sortedUpdates = [...rateUpdates].sort((left, right) => normalizeEnvioTimestamp(left.timestamp) - normalizeEnvioTimestamp(right.timestamp));
  let rateAtTarget = seedRateAtTarget;
  let updateIndex = 0;

  for (const historicalPoint of historicalStates) {
    while (updateIndex < sortedUpdates.length && normalizeEnvioTimestamp(sortedUpdates[updateIndex]!.timestamp) <= historicalPoint.timestamp) {
      rateAtTarget = normalizeRateAtTarget(normalizeEnvioString(sortedUpdates[updateIndex]!.rateAtTarget));
      updateIndex += 1;
    }

    const historicalMarket = new BlueMarket({
      fee: historicalPoint.state.fee,
      lastUpdate: historicalPoint.state.lastUpdate,
      params: new BlueMarketParams({
        collateralToken: market.collateralAsset.address as Address,
        irm: market.irmAddress as Address,
        lltv: BigInt(market.lltv),
        loanToken: market.loanAsset.address as Address,
        oracle: market.oracleAddress as Address,
      }),
      rateAtTarget,
      totalBorrowAssets: historicalPoint.state.totalBorrowAssets,
      totalBorrowShares: historicalPoint.state.totalBorrowShares,
      totalSupplyAssets: historicalPoint.state.totalSupplyAssets,
      totalSupplyShares: historicalPoint.state.totalSupplyShares,
    });

    const supplyAssetsRaw = Number(historicalPoint.state.totalSupplyAssets);
    const borrowAssetsRaw = Number(historicalPoint.state.totalBorrowAssets);
    const liquidityAssetsRaw = Number(
      historicalPoint.state.totalSupplyAssets > historicalPoint.state.totalBorrowAssets
        ? historicalPoint.state.totalSupplyAssets - historicalPoint.state.totalBorrowAssets
        : 0n,
    );

    const supplyAssets = toNumberValue(historicalPoint.state.totalSupplyAssets, loanAssetDecimals);
    const borrowAssets = toNumberValue(historicalPoint.state.totalBorrowAssets, loanAssetDecimals);
    const liquidityAssets = toNumberValue(
      historicalPoint.state.totalSupplyAssets > historicalPoint.state.totalBorrowAssets
        ? historicalPoint.state.totalSupplyAssets - historicalPoint.state.totalBorrowAssets
        : 0n,
      loanAssetDecimals,
    );

    addPoint(result.rates.supplyApy, historicalPoint.timestamp, historicalMarket.supplyApy);
    addPoint(result.rates.borrowApy, historicalPoint.timestamp, historicalMarket.borrowApy);
    addPoint(result.rates.apyAtTarget, historicalPoint.timestamp, historicalMarket.apyAtTarget ?? MarketUtils.rateToApy(rateAtTarget));
    addPoint(result.rates.utilization, historicalPoint.timestamp, Number(historicalMarket.utilization) / 1e18);
    addPoint(result.volumes.supplyAssets, historicalPoint.timestamp, supplyAssetsRaw);
    addPoint(result.volumes.borrowAssets, historicalPoint.timestamp, borrowAssetsRaw);
    addPoint(result.volumes.liquidityAssets, historicalPoint.timestamp, liquidityAssetsRaw);
    addPoint(result.volumes.supplyAssetsUsd, historicalPoint.timestamp, supplyAssets * loanAssetPrice);
    addPoint(result.volumes.borrowAssetsUsd, historicalPoint.timestamp, borrowAssets * loanAssetPrice);
    addPoint(result.volumes.liquidityAssetsUsd, historicalPoint.timestamp, liquidityAssets * loanAssetPrice);
  }

  return result;
};

export const fetchEnvioMarketHistoricalData = async (
  marketId: string,
  network: SupportedNetworks,
  options: TimeseriesOptions,
  requestOptions: {
    customRpcUrls?: CustomRpcUrls;
  } = {},
): Promise<HistoricalDataSuccessResult | null> => {
  const customRpcUrl = requestOptions.customRpcUrls?.[network];
  const market = await fetchMarketDetails(marketId, network, {
    customRpcUrls: requestOptions.customRpcUrls,
    enrichHistoricalApys: false,
  });

  if (!market) {
    return null;
  }

  const client = getClient(network, customRpcUrl);
  const chainContext = await fetchHistoricalChainContext({
    chainId: network,
    client,
    targetTimestamps: buildTimestamps(options),
    timeoutMs: HISTORICAL_TIMEOUT_MS,
  });

  if (!chainContext || chainContext.historicalBlocks.length === 0) {
    return null;
  }

  const [historicalStates, rateUpdates, latestRateUpdateBeforeWindow] = await Promise.all([
    fetchHistoricalStates({
      blocks: chainContext.historicalBlocks,
      chainId: network,
      customRpcUrl,
      marketId,
    }),
    fetchEnvioBorrowRateUpdates({
      chainId: network,
      marketId,
      timestampGte: options.startTimestamp,
      timestampLte: options.endTimestamp,
    }),
    fetchLatestEnvioBorrowRateUpdateBefore({
      chainId: network,
      marketId,
      timestampLte: options.startTimestamp,
    }),
  ]);

  if (historicalStates.length === 0) {
    return null;
  }

  return buildHistoricalResult({
    historicalStates,
    loanAssetDecimals: market.loanAsset.decimals,
    loanAssetPrice: deriveLoanAssetPrice(market),
    market,
    rateUpdates,
    seedRateAtTarget: latestRateUpdateBeforeWindow
      ? normalizeRateAtTarget(normalizeEnvioString(latestRateUpdateBeforeWindow.rateAtTarget))
      : normalizeRateAtTarget(market.state.rateAtTarget),
  });
};
