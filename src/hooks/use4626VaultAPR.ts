import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Address, Hex } from 'viem';
import morphoAbi from '@/abis/morpho';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { computeAnnualizedApyFromGrowth, computeExpectedNetCarryApy } from '@/hooks/leverage/math';
import { getMorphoAddress } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import type { Market } from '@/utils/types';
import { fetchVaultYieldSnapshots } from '@/utils/vaultYield';
import { getVaultReadKey } from '@/utils/vaultAllocation';

const DEFAULT_LOOKBACK_DAYS = 3;
const BORROW_INDEX_SCALE = 10n ** 18n;

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
  const customRpcUrl = customRpcUrls[chainId as SupportedNetworks];
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

      const vaultYieldSnapshots = await fetchVaultYieldSnapshots({
        vaults: [{ address: vaultAddress, networkId: chainId }],
        lookbackDays,
        customRpcUrls: { [chainId]: customRpcUrl },
        throwOnFailure: true,
      });
      const vaultYieldSnapshot = vaultYieldSnapshots.get(getVaultReadKey(vaultAddress, chainId)) ?? null;

      if (!vaultYieldSnapshot?.currentBlock || !vaultYieldSnapshot.pastBlock || !vaultYieldSnapshot.periodSeconds) {
        return {
          vaultApy3d: vaultYieldSnapshot?.vaultApy ?? null,
          borrowApy3d: null,
          sharePriceNow: vaultYieldSnapshot?.sharePriceNow ?? null,
          periodSeconds: vaultYieldSnapshot?.periodSeconds ?? null,
        };
      }

      const client = getClient(chainId, customRpcUrl);
      const morphoAddress = getMorphoAddress(chainId);
      const currentMarketResults = await client.multicall({
        contracts: [
          {
            address: morphoAddress as Address,
            abi: morphoAbi,
            functionName: 'market' as const,
            args: [market.uniqueKey as Hex] as const,
          },
        ],
        allowFailure: true,
        blockNumber: vaultYieldSnapshot.currentBlock,
      });

      let pastMarketResults: typeof currentMarketResults | null = null;
      try {
        pastMarketResults = await client.multicall({
          contracts: [
            {
              address: morphoAddress as Address,
              abi: morphoAbi,
              functionName: 'market' as const,
              args: [market.uniqueKey as Hex] as const,
            },
          ],
          allowFailure: true,
          blockNumber: vaultYieldSnapshot.pastBlock,
        });
      } catch {
        // Some RPCs are non-archive and cannot serve historical eth_call at past blocks.
        pastMarketResults = null;
      }

      const currentBorrowIndex =
        currentMarketResults[0].status === 'success' ? readBorrowIndex(asBigIntArray(currentMarketResults[0].result)) : null;
      const pastBorrowIndex =
        pastMarketResults?.[0]?.status === 'success' ? readBorrowIndex(asBigIntArray(pastMarketResults[0].result)) : null;

      const borrowApy3d =
        currentBorrowIndex && pastBorrowIndex
          ? computeAnnualizedApyFromGrowth({
              currentValue: currentBorrowIndex,
              pastValue: pastBorrowIndex,
              periodSeconds: vaultYieldSnapshot.periodSeconds,
            })
          : null;

      return {
        vaultApy3d: vaultYieldSnapshot.vaultApy,
        borrowApy3d,
        sharePriceNow: vaultYieldSnapshot.sharePriceNow,
        periodSeconds: vaultYieldSnapshot.periodSeconds,
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
