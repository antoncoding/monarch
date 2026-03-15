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
  tokenSymbol: string;
  tokenDecimals: number;
  allocators: string[];
  sentinels: string[];
  owner: string;
  curator: string;
  capsData: CapData;
  adapters: string[];
  adapterDetails: VaultAdapterDetails[];
  curatorDisplay: string;
};

type BasicVaultRpcData = {
  assetAddress: string;
  adapters: string[];
  curator: string;
  displayName: string;
  displaySymbol: string;
  owner: string;
};

const fetchBasicVaultRpcData = async (vaultAddress: Address, chainId: SupportedNetworks): Promise<BasicVaultRpcData> => {
  const client = getClient(chainId);
  const contractBase = { address: vaultAddress, abi: vaultv2Abi } as const;
  const [owner, curator, name, symbol, asset] = await client.multicall({
    contracts: [
      { ...contractBase, functionName: 'owner', args: [] },
      { ...contractBase, functionName: 'curator', args: [] },
      { ...contractBase, functionName: 'name', args: [] },
      { ...contractBase, functionName: 'symbol', args: [] },
      { ...contractBase, functionName: 'asset', args: [] },
    ],
    allowFailure: true,
  });

  const adaptersLength = await client
    .readContract({
      ...contractBase,
      functionName: 'adaptersLength',
      args: [],
    })
    .catch(() => 0n);

  let adapters: string[] = [];
  if (adaptersLength > 0n) {
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
    displayName: name.status === 'success' ? name.result : '',
    displaySymbol: symbol.status === 'success' ? symbol.result : '',
    assetAddress: asset.status === 'success' && asset.result !== zeroAddress ? asset.result : '',
  };
};

export function useVaultV2Data({ vaultAddress, chainId, fallbackName = '', fallbackSymbol = '' }: UseVaultV2DataArgs) {
  const { findToken } = useTokensQuery();

  const query = useQuery({
    queryKey: ['vault-v2-data', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) {
        return null;
      }

      let monarchVault = null;
      try {
        monarchVault = await fetchMonarchVaultDetails(vaultAddress, chainId);
      } catch (monarchError) {
        console.warn('[useVaultV2Data] Monarch vault fetch failed, continuing with RPC fallback:', monarchError);
      }

      let rpcFallback: BasicVaultRpcData | null = null;
      if (!monarchVault) {
        try {
          rpcFallback = await fetchBasicVaultRpcData(vaultAddress, chainId);
        } catch (rpcError) {
          console.warn('[useVaultV2Data] RPC fallback failed for vault metadata:', rpcError);
        }
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

      return {
        displayName: monarchVault?.name || rpcFallback?.displayName || fallbackName,
        displaySymbol: monarchVault?.symbol || rpcFallback?.displaySymbol || fallbackSymbol,
        assetAddress,
        tokenSymbol,
        tokenDecimals,
        allocators: monarchVault?.allocators ?? [],
        sentinels: monarchVault?.sentinels ?? [],
        owner: monarchVault?.owner || rpcFallback?.owner || '',
        curator,
        capsData: {
          adapterCap,
          collateralCaps,
          marketCaps,
          needSetupCaps: !adapterCap || collateralCaps.length === 0 || marketCaps.length === 0,
        },
        adapters: monarchVault?.adapters ?? rpcFallback?.adapters ?? [],
        adapterDetails: monarchVault?.adapterDetails ?? [],
        curatorDisplay: curator ? getSlicedAddress(curator as Address) : '--',
      } satisfies VaultV2Data;
    },
    enabled: Boolean(vaultAddress),
    staleTime: 30_000,
  });

  return query;
}
