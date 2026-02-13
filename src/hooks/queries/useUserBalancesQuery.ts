import { useMemo } from 'react';
import { type Address, erc20Abi } from 'viem';
import { useConnection, useReadContracts } from 'wagmi';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { type SupportedNetworks, ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import { supportedTokens } from '@/utils/tokens';

export type TokenBalance = {
  address: string;
  balance: string;
  chainId: number;
  decimals: number;
  symbol: string;
};

type UseUserBalancesOptions = {
  address?: string;
  networkIds?: SupportedNetworks[];
  enabled?: boolean;
};

type TokenEntry = {
  address: string;
  chainId: number;
};

/**
 * Fetches user token balances across specified networks using wagmi's useReadContracts.
 *
 * Makes direct RPC multicalls from the browser — no API route needed.
 * Wagmi groups calls by chainId and issues parallel multicalls automatically.
 *
 * @example
 * ```tsx
 * const { data: balances, isLoading, error } = useUserBalancesQuery({
 *   address: '0x...',
 *   networkIds: [SupportedNetworks.Mainnet, SupportedNetworks.Base],
 * });
 * ```
 */
export const useUserBalancesQuery = (options: UseUserBalancesOptions = {}) => {
  const { address: connectedAddress } = useConnection();
  const { findToken } = useTokensQuery();

  const address = options.address ?? connectedAddress;
  const networksToFetch = options.networkIds ?? ALL_SUPPORTED_NETWORKS;
  const enabled = options.enabled ?? true;

  // Build the list of token entries (address + chainId) for all requested networks
  const tokenEntries = useMemo(() => {
    const entries: TokenEntry[] = [];
    for (const token of supportedTokens) {
      for (const network of token.networks) {
        if (networksToFetch.includes(network.chain.id as SupportedNetworks)) {
          entries.push({
            address: network.address,
            chainId: network.chain.id,
          });
        }
      }
    }
    return entries;
  }, [networksToFetch]);

  // Build wagmi contract calls — one balanceOf per token entry
  const contracts = useMemo(() => {
    if (!address) return [];
    return tokenEntries.map((entry) => ({
      address: entry.address as Address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address as Address] as const,
      chainId: entry.chainId,
    }));
  }, [address, tokenEntries]);

  const {
    data: rawResults,
    isLoading,
    isError,
    error,
  } = useReadContracts({
    contracts,
    query: {
      enabled: enabled && Boolean(address) && contracts.length > 0,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  });

  // Process results: filter failures and zero balances, enrich with token metadata
  const data = useMemo(() => {
    if (!rawResults) return undefined;

    const balances: TokenBalance[] = [];

    for (let i = 0; i < rawResults.length; i++) {
      const result = rawResults[i];
      if (result?.status !== 'success' || result.result === undefined) continue;

      const balance = result.result as bigint;
      if (balance <= 0n) continue;

      const entry = tokenEntries[i];
      const tokenInfo = findToken(entry.address, entry.chainId);
      if (!tokenInfo) continue;

      balances.push({
        address: entry.address.toLowerCase(),
        balance: balance.toString(10),
        chainId: entry.chainId,
        decimals: tokenInfo.decimals,
        symbol: tokenInfo.symbol,
      });
    }

    return balances;
  }, [rawResults, tokenEntries, findToken]);

  return { data, isLoading, isError, error };
};

/**
 * Helper hook to fetch balances from all networks.
 *
 * @example
 * ```tsx
 * const { data: balances, isLoading, error } = useUserBalancesAllNetworksQuery();
 * ```
 */
export const useUserBalancesAllNetworksQuery = () => {
  return useUserBalancesQuery({
    networkIds: ALL_SUPPORTED_NETWORKS,
  });
};
