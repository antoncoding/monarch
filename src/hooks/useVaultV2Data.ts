import type { Address } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { useTokens } from '@/components/providers/TokenProvider';
import { fetchVaultV2Details, type VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { getSlicedAddress } from '@/utils/address';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';

type UseVaultV2DataArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
  fallbackName?: string;
  fallbackSymbol?: string;
};

export type CapData = {
  adapterCap: VaultV2Cap | null;
  collateralCaps: VaultV2Cap[];
  marketCaps: VaultV2Cap[];
  needSetupCaps: boolean;
};

export type VaultV2Data = {
  displayName: string;
  displaySymbol: string;
  assetAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  allocators: string[];
  sentinels: string[];
  owner: string;
  curator: string;
  capsData: CapData;
  adapters: string[];
  curatorDisplay: string;
};

export function useVaultV2Data({ vaultAddress, chainId, fallbackName = '', fallbackSymbol = '' }: UseVaultV2DataArgs) {
  const { findToken } = useTokens();

  const query = useQuery({
    queryKey: ['vault-v2-data', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) {
        return null;
      }

      const result = await fetchVaultV2Details(vaultAddress, chainId);

      if (!result) {
        return null;
      }

      const token = result.asset ? findToken(result.asset, chainId) : undefined;
      const curatorDisplay = result.curator ? getSlicedAddress(result.curator as Address) : '--';

      // Parse caps by level using parseCapIdParams
      let adapterCap: VaultV2Cap | null = null;
      const collateralCaps: VaultV2Cap[] = [];
      const marketCaps: VaultV2Cap[] = [];

      result.caps.forEach((cap) => {
        const parsed = parseCapIdParams(cap.idParams);

        if (parsed.type === 'adapter') {
          adapterCap = cap;
        } else if (parsed.type === 'collateral') {
          collateralCaps.push(cap);
        } else if (parsed.type === 'market') {
          marketCaps.push(cap);
        }
      });

      // if any one of the caps is not set, it means it still need setup!
      const needSetupCaps = !adapterCap || collateralCaps.length === 0 || marketCaps.length === 0;

      const vaultData: VaultV2Data = {
        displayName: result.name || fallbackName,
        displaySymbol: result.symbol || fallbackSymbol,
        assetAddress: result.asset,
        tokenSymbol: token?.symbol,
        tokenDecimals: token?.decimals,
        allocators: result.allocators,
        sentinels: result.sentinels,
        owner: result.owner,
        curator: result.curator,
        capsData: {
          adapterCap,
          collateralCaps,
          marketCaps,
          needSetupCaps,
        },
        adapters: result.adapters,
        curatorDisplay,
      };

      return vaultData;
    },
    enabled: Boolean(vaultAddress),
    staleTime: 30_000, // 30 seconds - data is cacheable across components
  });

  return query;
}
