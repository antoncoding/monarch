import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Address, Hex } from 'viem';
import { erc4626Abi } from '@/abis/erc4626';
import morphoAbi from '@/abis/morpho';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { computeAnnualizedApyFromGrowth, computeExpectedNetCarryApy } from '@/hooks/leverage/math';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import { getMorphoAddress } from '@/utils/morpho';
import { getClient } from '@/utils/rpc';
import type { Market } from '@/utils/types';

const DEFAULT_LOOKBACK_DAYS = 3;
const BORROW_INDEX_SCALE = 10n ** 18n;
const SECONDS_PER_DAY = 24 * 60 * 60;

type Use4626VaultAPRParams = {
  market: Market;
  vaultAddress: Address | undefined;
  projectedCollateralShares: bigint;
  projectedBorrowAssets: bigint;
  lookbackDays?: number;
  enabled?: boolean;
};

type QueryResult = {
  vaultApy3d: number | null;
  borrowApy3d: number | null;
  sharePriceNow: bigint | null;
  periodSeconds: number | null;
};

type Use4626VaultAPRResult = QueryResult & {
  expectedNetApy: number | null;
  isLoading: boolean;
  error: string | null;
};

const asBigIntArray = (value: unknown): readonly bigint[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === 'bigint')) return null;
  return value as readonly bigint[];
};

const readBorrowIndex = (marketState: readonly bigint[] | null): bigint | null => {
  if (!marketState) return null;
  const totalBorrowAssets = marketState[2];
  const totalBorrowShares = marketState[3];
  if (typeof totalBorrowAssets !== 'bigint' || typeof totalBorrowShares !== 'bigint') return null;
  if (totalBorrowAssets <= 0n || totalBorrowShares <= 0n) return null;
  // WHY: Morpho borrow index is implied by assets/shares growth over time.
  return (totalBorrowAssets * BORROW_INDEX_SCALE) / totalBorrowShares;
};

export function use4626VaultAPR({
  market,
  vaultAddress,
  projectedCollateralShares,
  projectedBorrowAssets,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  enabled = true,
}: Use4626VaultAPRParams): Use4626VaultAPRResult {
  const { customRpcUrls } = useCustomRpcContext();
  const chainId = market.morphoBlue.chain.id;
  const customRpcUrl = customRpcUrls[chainId];
  const oneShareUnit = useMemo(() => 10n ** BigInt(market.collateralAsset.decimals), [market.collateralAsset.decimals]);

  const query = useQuery<QueryResult>({
    queryKey: ['vault-4626-apr', market.uniqueKey, chainId, vaultAddress, lookbackDays, customRpcUrl],
    enabled: enabled && !!vaultAddress,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!vaultAddress) {
        return {
          vaultApy3d: null,
          borrowApy3d: null,
          sharePriceNow: null,
          periodSeconds: null,
        };
      }

      const client = getClient(chainId, customRpcUrl);
      const currentBlock = await client.getBlockNumber();
      const currentBlockData = await client.getBlock({ blockNumber: currentBlock });
      const currentTimestamp = Number(currentBlockData.timestamp);

      const targetTimestamp = currentTimestamp - lookbackDays * SECONDS_PER_DAY;
      // WHY: estimate a historical block close to the target window, then annualize using real block timestamps.
      const estimatedPastBlock = estimateBlockAtTimestamp(chainId, targetTimestamp, Number(currentBlock), currentTimestamp);
      const pastBlockData = await client.getBlock({ blockNumber: BigInt(estimatedPastBlock) });
      const pastTimestamp = Number(pastBlockData.timestamp);
      const periodSeconds = currentTimestamp - pastTimestamp;

      if (periodSeconds <= 0) {
        return {
          vaultApy3d: null,
          borrowApy3d: null,
          sharePriceNow: null,
          periodSeconds: null,
        };
      }

      const morphoAddress = getMorphoAddress(chainId);
      const contracts = [
        {
          address: vaultAddress,
          abi: erc4626Abi,
          functionName: 'previewRedeem' as const,
          args: [oneShareUnit] as const,
        },
        {
          address: morphoAddress as Address,
          abi: morphoAbi,
          functionName: 'market' as const,
          args: [market.uniqueKey as Hex] as const,
        },
      ] as const;

      const currentResults = await client.multicall({
        contracts,
        allowFailure: true,
      });

      let pastResults: typeof currentResults | null = null;
      try {
        pastResults = await client.multicall({
          contracts,
          allowFailure: true,
          blockNumber: BigInt(estimatedPastBlock),
        });
      } catch {
        // Some RPCs are non-archive and cannot serve historical eth_call at past blocks.
        pastResults = null;
      }

      const currentSharePrice =
        currentResults[0].status === 'success' && typeof currentResults[0].result === 'bigint' ? currentResults[0].result : null;
      const currentBorrowIndex = currentResults[1].status === 'success' ? readBorrowIndex(asBigIntArray(currentResults[1].result)) : null;

      const pastSharePrice =
        pastResults?.[0]?.status === 'success' && typeof pastResults[0].result === 'bigint' ? pastResults[0].result : null;
      const pastBorrowIndex = pastResults?.[1]?.status === 'success' ? readBorrowIndex(asBigIntArray(pastResults[1].result)) : null;

      const vaultApy3d =
        currentSharePrice && pastSharePrice
          ? computeAnnualizedApyFromGrowth({
              currentValue: currentSharePrice,
              pastValue: pastSharePrice,
              periodSeconds,
            })
          : null;

      const borrowApy3d =
        currentBorrowIndex && pastBorrowIndex
          ? computeAnnualizedApyFromGrowth({
              currentValue: currentBorrowIndex,
              pastValue: pastBorrowIndex,
              periodSeconds,
            })
          : null;

      return {
        vaultApy3d,
        borrowApy3d,
        sharePriceNow: currentSharePrice,
        periodSeconds,
      };
    },
  });

  const expectedNetApy = useMemo(() => {
    if (!query.data?.sharePriceNow || query.data.vaultApy3d == null || query.data.borrowApy3d == null) return null;
    return computeExpectedNetCarryApy({
      collateralShares: projectedCollateralShares,
      borrowAssets: projectedBorrowAssets,
      sharePriceInUnderlying: query.data.sharePriceNow,
      oneShareUnit,
      vaultApy: query.data.vaultApy3d,
      borrowApy: query.data.borrowApy3d,
    });
  }, [
    query.data?.sharePriceNow,
    query.data?.vaultApy3d,
    query.data?.borrowApy3d,
    projectedCollateralShares,
    projectedBorrowAssets,
    oneShareUnit,
  ]);

  return {
    vaultApy3d: query.data?.vaultApy3d ?? null,
    borrowApy3d: query.data?.borrowApy3d ?? null,
    sharePriceNow: query.data?.sharePriceNow ?? null,
    periodSeconds: query.data?.periodSeconds ?? null,
    expectedNetApy,
    isLoading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
