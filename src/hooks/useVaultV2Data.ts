import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { vaultv2Abi } from '@/abis/vaultv2';
import { fetchMonarchVaultDetails, type VaultAdapterDetails, type VaultV2Cap } from '@/data-sources/monarch-api/vaults';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { getSlicedAddress } from '@/utils/address';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

type UseVaultV2DataArgs = {
  vaultAddress?: Address;
  chainId: SupportedNetworks;
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
  tokenSymbol: string;
  tokenDecimals: number;
  allocators: string[];
  sentinels: string[];
  owner: string;
  curator: string;
  capsData?: CapData;
  adapters: string[];
  adapterDetails: VaultAdapterDetails[];
  curatorDisplay: string;
};

type BasicVaultRpcData = {
  assetAddress: string;
  adapters: string[];
  curator: string;
  owner: string;
};

const fetchBasicVaultRpcData = async (vaultAddress: Address, chainId: SupportedNetworks): Promise<BasicVaultRpcData> => {
  const client = getClient(chainId);
  const contractBase = { address: vaultAddress, abi: vaultv2Abi } as const;
  const [owner, curator, asset] = await client.multicall({
    contracts: [
      { ...contractBase, functionName: 'owner', args: [] },
      { ...contractBase, functionName: 'curator', args: [] },
      { ...contractBase, functionName: 'asset', args: [] },
    ],
    allowFailure: true,
  });

  const hasCoreSuccess = owner.status === 'success' || curator.status === 'success' || asset.status === 'success';
  const adaptersLength = await client
    .readContract({
      ...contractBase,
      functionName: 'adaptersLength',
      args: [],
    })
    .catch(() => null);

  if (!hasCoreSuccess && adaptersLength === null) {
    throw new Error('RPC_UNAVAILABLE');
  }

  let adapters: string[] = [];
  if (adaptersLength && adaptersLength > 0n) {
    const adapterResults = await client.multicall({
      contracts: Array.from({ length: Number(adaptersLength) }, (_, index) => ({
        ...contractBase,
        functionName: 'adapters' as const,
        args: [BigInt(index)],
      })),
      allowFailure: true,
    });

    adapters = adapterResults.flatMap((result) => {
      if (result.status !== 'success' || result.result === zeroAddress) {
        return [];
      }
      return [result.result.toLowerCase()];
    });
  }

  return {
    adapters,
    owner: owner.status === 'success' && owner.result !== zeroAddress ? owner.result : '',
    curator: curator.status === 'success' && curator.result !== zeroAddress ? curator.result : '',
    assetAddress: asset.status === 'success' && asset.result !== zeroAddress ? asset.result : '',
  };
};

export function useVaultV2Data({ vaultAddress, chainId }: UseVaultV2DataArgs) {
  const { findToken } = useTokensQuery();
  const normalizedVaultAddress = vaultAddress?.toLowerCase() as Address | undefined;

  const query = useQuery({
    queryKey: ['vault-v2-data', normalizedVaultAddress, chainId],
    queryFn: async () => {
      if (!normalizedVaultAddress) {
        return null;
      }

      let monarchVault = null;
      try {
        monarchVault = await fetchMonarchVaultDetails(normalizedVaultAddress, chainId);
      } catch (monarchError) {
        console.warn('[useVaultV2Data] Monarch vault fetch failed, continuing with RPC fallback:', monarchError);
      }

      let rpcFallback: BasicVaultRpcData | null = null;
      if (!monarchVault) {
        try {
          rpcFallback = await fetchBasicVaultRpcData(normalizedVaultAddress, chainId);
        } catch (rpcError) {
          console.warn('[useVaultV2Data] RPC fallback failed for vault metadata:', rpcError);
        }
      }

      if (!monarchVault && !rpcFallback) {
        throw new Error('Failed to load vault metadata from Monarch API and RPC fallback');
      }

      const caps = monarchVault?.caps ?? [];
      let adapterCap: VaultV2Cap | null = null;
      const collateralCaps: VaultV2Cap[] = [];
      const marketCaps: VaultV2Cap[] = [];

      for (const cap of caps) {
        const parsed = parseCapIdParams(cap.idParams);
        if (parsed.type === 'adapter') {
          adapterCap = cap;
          continue;
        }
        if (parsed.type === 'collateral') {
          collateralCaps.push(cap);
          continue;
        }
        if (parsed.type === 'market') {
          marketCaps.push(cap);
        }
      }

      const assetAddress = monarchVault?.asset || rpcFallback?.assetAddress || '';
      const token = assetAddress ? findToken(assetAddress, chainId) : undefined;
      const tokenSymbol = token?.symbol ?? '--';
      const tokenDecimals = token?.decimals ?? 18;
      const curator = monarchVault?.curator || rpcFallback?.curator || '';
      const capsData = monarchVault
        ? {
            adapterCap,
            collateralCaps,
            marketCaps,
            needSetupCaps: !adapterCap || collateralCaps.length === 0 || marketCaps.length === 0,
          }
        : undefined;

      return {
        displayName: monarchVault?.name || '',
        displaySymbol: monarchVault?.symbol || '',
        assetAddress,
        tokenSymbol,
        tokenDecimals,
        allocators: monarchVault?.allocators ?? [],
        sentinels: monarchVault?.sentinels ?? [],
        owner: monarchVault?.owner || rpcFallback?.owner || '',
        curator,
        capsData,
        adapters: monarchVault?.adapters ?? rpcFallback?.adapters ?? [],
        adapterDetails: monarchVault?.adapterDetails ?? [],
        curatorDisplay: curator ? getSlicedAddress(curator as Address) : '--',
      } satisfies VaultV2Data;
    },
    enabled: Boolean(normalizedVaultAddress),
    staleTime: 30_000,
  });

  return query;
}
