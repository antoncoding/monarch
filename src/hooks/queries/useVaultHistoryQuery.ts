import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { fetchMorphoVaultV2History } from '@/data-sources/morpho-api/vault-history';
import { fetchRpcVaultHistory } from '@/data-sources/rpc/vault-history';
import { TIMEFRAME_CONFIG, type ChartTimeframe } from '@/stores/useMarketDetailChartState';
import { supportsHistoricalStateRead, type SupportedNetworks } from '@/utils/networks';
import type { TimeseriesOptions } from '@/utils/types';

const API_INTERVAL_BY_TIMEFRAME: Record<ChartTimeframe, TimeseriesOptions['interval']> = {
  '1d': 'HOUR',
  '7d': 'HOUR',
  '30d': 'DAY',
  '3m': 'DAY',
  '6m': 'DAY',
};

export type VaultHistoryPoint = {
  blockNumber?: number;
  timestamp: number;
  value: number;
};

export type VaultHistory = {
  nativeApy: VaultHistoryPoint[];
  sharePrice: VaultHistoryPoint[];
  sharePriceSource: 'morpho-api' | 'none' | 'rpc';
  totalAssets: VaultHistoryPoint[];
  totalAssetsSource: 'morpho-api' | 'none' | 'rpc';
};

export function useVaultHistoryQuery({
  assetDecimals,
  vaultAddress,
  chainId,
  timeframe,
  timeRange,
}: {
  assetDecimals?: number;
  vaultAddress?: Address;
  chainId?: SupportedNetworks;
  timeframe: ChartTimeframe;
  timeRange: TimeseriesOptions;
}) {
  const { customRpcUrls } = useCustomRpcContext();
  const customRpcUrl = chainId ? customRpcUrls[chainId] : undefined;

  return useQuery<VaultHistory | null>({
    queryKey: [
      'vault-history',
      vaultAddress?.toLowerCase() ?? null,
      chainId ?? null,
      timeframe,
      timeRange.startTimestamp,
      timeRange.endTimestamp,
      assetDecimals ?? null,
      customRpcUrl ?? null,
    ],
    queryFn: async () => {
      if (!vaultAddress || !chainId || assetDecimals === undefined) {
        return null;
      }

      // Monarch indexes cumulative flows, but historical total assets must also include accrued yield.
      // Morpho's snapshots provide that accrued value; RPC is the exact fallback when they are unavailable.
      const morphoHistory = await fetchMorphoVaultV2History({
        vaultAddress,
        chainId,
        options: { ...timeRange, interval: API_INTERVAL_BY_TIMEFRAME[timeframe] },
      });
      const nativeApy = (morphoHistory?.nativeApy ?? []).map((point) => ({
        timestamp: point.timestamp,
        value: point.value,
      }));
      const sharePrice = (morphoHistory?.sharePrice ?? []).map((point) => ({
        timestamp: point.timestamp,
        value: point.value,
      }));
      const apiTotalAssets = (morphoHistory?.totalAssets ?? []).map((point) => ({
        timestamp: point.timestamp,
        value: point.value / 10 ** assetDecimals,
      }));
      const hasApiSharePrice = sharePrice.length >= 2;
      const hasApiTotalAssets = apiTotalAssets.length >= 2;

      if (hasApiSharePrice && hasApiTotalAssets) {
        return {
          nativeApy,
          sharePrice,
          sharePriceSource: 'morpho-api',
          totalAssets: apiTotalAssets,
          totalAssetsSource: 'morpho-api',
        };
      }

      if (!supportsHistoricalStateRead(chainId)) {
        return {
          nativeApy,
          sharePrice,
          sharePriceSource: hasApiSharePrice ? 'morpho-api' : 'none',
          totalAssets: apiTotalAssets,
          totalAssetsSource: hasApiTotalAssets ? 'morpho-api' : 'none',
        };
      }

      const rpcHistory = await fetchRpcVaultHistory({
        assetDecimals,
        chainId,
        customRpcUrl,
        endTimestamp: timeRange.endTimestamp,
        intervalSeconds: TIMEFRAME_CONFIG[timeframe].intervalSeconds,
        startTimestamp: timeRange.startTimestamp,
        vaultAddress,
      });

      return {
        nativeApy,
        sharePrice: hasApiSharePrice ? sharePrice : rpcHistory.sharePrice,
        sharePriceSource: hasApiSharePrice ? 'morpho-api' : rpcHistory.sharePrice.length >= 2 ? 'rpc' : 'none',
        totalAssets: hasApiTotalAssets ? apiTotalAssets : rpcHistory.totalAssets,
        totalAssetsSource: hasApiTotalAssets ? 'morpho-api' : rpcHistory.totalAssets.length >= 2 ? 'rpc' : 'none',
      };
    },
    enabled: Boolean(vaultAddress && chainId && timeframe && timeRange && assetDecimals !== undefined),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
