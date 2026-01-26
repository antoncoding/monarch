import type { Address } from 'viem';
import { zeroAddress } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { vaultv2Abi } from '@/abis/vaultv2';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { fetchVaultV2Details, type VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { getSlicedAddress } from '@/utils/address';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { useVaultKeysCache, type CachedCap } from '@/stores/useVaultKeysCache';

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
  tokenSymbol: string; // Always has default: '--'
  tokenDecimals: number; // Always has default: 18
  allocators: string[];
  sentinels: string[];
  owner: string;
  curator: string;
  capsData: CapData;
  adapters: string[];
  curatorDisplay: string;
};

// --- Merge helpers: deduplicate API + cache keys ---

function mergeAllocatorKeys(apiAllocators: string[] | undefined, cachedAllocators: { address: string }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const addr of apiAllocators ?? []) {
    const lower = addr.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }

  for (const cached of cachedAllocators) {
    const lower = cached.address.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }

  return result;
}

function mergeCapKeys(apiCaps: VaultV2Cap[] | undefined, cachedCaps: CachedCap[]): CachedCap[] {
  const seen = new Set<string>();
  const result: CachedCap[] = [];

  for (const cap of apiCaps ?? []) {
    if (!seen.has(cap.capId)) {
      seen.add(cap.capId);
      result.push({ capId: cap.capId, idParams: cap.idParams });
    }
  }

  for (const cached of cachedCaps) {
    if (!seen.has(cached.capId)) {
      seen.add(cached.capId);
      result.push(cached);
    }
  }

  return result;
}

function mergeAdapterKeys(apiAdapters: string[] | undefined, cachedAdapters: { address: string }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const addr of apiAdapters ?? []) {
    const lower = addr.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }

  for (const cached of cachedAdapters) {
    const lower = cached.address.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }

  return result;
}

// --- Multicall index layout ---
// [0] owner, [1] curator, [2] name, [3] symbol, [4] asset
const BASIC_FIELD_COUNT = 5;

export function useVaultV2Data({ vaultAddress, chainId, fallbackName = '', fallbackSymbol = '' }: UseVaultV2DataArgs) {
  const { findToken } = useTokensQuery();
  const { getVaultKeys, seedFromApi } = useVaultKeysCache(vaultAddress, chainId);

  const query = useQuery({
    queryKey: ['vault-v2-data', vaultAddress, chainId],
    queryFn: async () => {
      if (!vaultAddress) {
        return null;
      }

      // --- Stage 1: Discovery (API seed + cache merge) ---

      // Try Morpho API — gracefully handle errors (e.g. new vault not indexed yet)
      let apiResult = null;
      try {
        apiResult = await fetchVaultV2Details(vaultAddress, chainId);
      } catch (apiError) {
        console.warn('[useVaultV2Data] API fetch failed, continuing with cache + RPC:', apiError);
      }

      // Read cached keys
      const cachedKeys = getVaultKeys();

      // Merge API + cache keys with deduplication
      const allocatorAddresses = mergeAllocatorKeys(apiResult?.allocators, cachedKeys.allocators);
      const capEntries = mergeCapKeys(apiResult?.caps, cachedKeys.caps);
      const adapterAddresses = mergeAdapterKeys(apiResult?.adapters, cachedKeys.adapters);

      // Seed cache with API-discovered keys (deduplication handled by store)
      if (apiResult) {
        seedFromApi({
          allocators: apiResult.allocators.map((a) => ({ address: a })),
          caps: apiResult.caps.map((c) => ({ capId: c.capId, idParams: c.idParams })),
          adapters: apiResult.adapters.map((a) => ({ address: a })),
        });
      }

      // --- Stage 2: RPC truth (single multicall) ---

      const client = getClient(chainId);
      const contractBase = { address: vaultAddress, abi: vaultv2Abi } as const;

      // Build multicall contracts array with known layout:
      // [0..4] = basic fields (owner, curator, name, symbol, asset)
      // [5..5+N-1] = isAllocator for each allocator
      // [5+N..5+N+2M-1] = relativeCap/absoluteCap pairs for each cap
      // [5+N+2M..end] = isAdapter for each adapter
      const contracts = [
        // Basic vault data (always read from RPC)
        { ...contractBase, functionName: 'owner' as const, args: [] },
        { ...contractBase, functionName: 'curator' as const, args: [] },
        { ...contractBase, functionName: 'name' as const, args: [] },
        { ...contractBase, functionName: 'symbol' as const, args: [] },
        { ...contractBase, functionName: 'asset' as const, args: [] },
        // Allocator checks
        ...allocatorAddresses.map((addr) => ({
          ...contractBase,
          functionName: 'isAllocator' as const,
          args: [addr as Address],
        })),
        // Cap values (2 calls per cap: relative + absolute)
        ...capEntries.flatMap((cap) => [
          { ...contractBase, functionName: 'relativeCap' as const, args: [cap.capId as `0x${string}`] },
          { ...contractBase, functionName: 'absoluteCap' as const, args: [cap.capId as `0x${string}`] },
        ]),
        // Adapter checks
        ...adapterAddresses.map((addr) => ({
          ...contractBase,
          functionName: 'isAdapter' as const,
          args: [addr as Address],
        })),
      ];

      const results = await client.multicall({
        contracts,
        allowFailure: true,
      });

      // --- Process results ---

      // Basic fields
      const rpcOwner = (results[0].status === 'success' ? results[0].result : zeroAddress) as Address;
      const rpcCurator = (results[1].status === 'success' ? results[1].result : zeroAddress) as Address;
      const rpcName = (results[2].status === 'success' ? results[2].result : '') as string;
      const rpcSymbol = (results[3].status === 'success' ? results[3].result : '') as string;
      const rpcAsset = (results[4].status === 'success' ? results[4].result : zeroAddress) as Address;

      // Offsets
      const allocatorOffset = BASIC_FIELD_COUNT;
      const capsOffset = allocatorOffset + allocatorAddresses.length;
      const adapterOffset = capsOffset + capEntries.length * 2;

      // Filter active allocators
      const activeAllocators: string[] = [];
      for (let i = 0; i < allocatorAddresses.length; i++) {
        const r = results[allocatorOffset + i];
        if (r.status === 'success' && r.result === true) {
          activeAllocators.push(allocatorAddresses[i]);
        }
      }

      // Build caps with RPC values, classify by type
      let adapterCap: VaultV2Cap | null = null;
      const collateralCaps: VaultV2Cap[] = [];
      const marketCaps: VaultV2Cap[] = [];

      for (let i = 0; i < capEntries.length; i++) {
        const relIdx = capsOffset + i * 2;
        const absIdx = capsOffset + i * 2 + 1;
        const relResult = results[relIdx];
        const absResult = results[absIdx];

        const relativeCapValue = relResult.status === 'success' ? (relResult.result as bigint) : 0n;
        const absoluteCapValue = absResult.status === 'success' ? (absResult.result as bigint) : 0n;

        // Skip caps where both values are zero (removed or unset)
        if (relativeCapValue === 0n && absoluteCapValue === 0n) continue;

        const cap: VaultV2Cap = {
          capId: capEntries[i].capId,
          idParams: capEntries[i].idParams,
          relativeCap: relativeCapValue.toString(),
          absoluteCap: absoluteCapValue.toString(),
        };

        const parsed = parseCapIdParams(cap.idParams);
        if (parsed.type === 'adapter') {
          adapterCap = cap;
        } else if (parsed.type === 'collateral') {
          collateralCaps.push(cap);
        } else if (parsed.type === 'market') {
          marketCaps.push(cap);
        }
      }

      // Filter active adapters
      const activeAdapters: string[] = [];
      for (let i = 0; i < adapterAddresses.length; i++) {
        const r = results[adapterOffset + i];
        if (r.status === 'success' && r.result === true) {
          activeAdapters.push(adapterAddresses[i]);
        }
      }

      // Resolve token metadata
      const assetAddress = rpcAsset !== zeroAddress ? rpcAsset : (apiResult?.asset ?? '');
      const token = assetAddress ? findToken(assetAddress, chainId) : undefined;
      const tokenSymbol = token?.symbol ?? '--';
      const tokenDecimals = token?.decimals ?? 18;

      // Curator display
      const curatorAddr = rpcCurator !== zeroAddress ? rpcCurator : (apiResult?.curator ?? '');
      const curatorDisplay = curatorAddr ? getSlicedAddress(curatorAddr as Address) : '--';

      // Sentinels come from API only (not cached, not critical for post-init flow)
      const sentinels = apiResult?.sentinels ?? [];

      const needSetupCaps = !adapterCap || collateralCaps.length === 0 || marketCaps.length === 0;

      const vaultData: VaultV2Data = {
        displayName: rpcName || apiResult?.name || fallbackName,
        displaySymbol: rpcSymbol || apiResult?.symbol || fallbackSymbol,
        assetAddress,
        tokenSymbol,
        tokenDecimals,
        allocators: activeAllocators,
        sentinels,
        owner: rpcOwner !== zeroAddress ? rpcOwner : (apiResult?.owner ?? ''),
        curator: curatorAddr,
        capsData: {
          adapterCap,
          collateralCaps,
          marketCaps,
          needSetupCaps,
        },
        adapters: activeAdapters,
        curatorDisplay,
      };

      return vaultData;
    },
    enabled: Boolean(vaultAddress),
    staleTime: 30_000, // 30 seconds - data is cacheable across components
  });

  return query;
}
