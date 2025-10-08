import { Address, erc20Abi } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

type VaultV2RpcResult = {
  name?: string;
  symbol?: string;
  totalSupply?: bigint;
  assetAddress?: Address;
  assetDecimals?: number;
  owner?: Address;
  curator?: Address;
};

/**
 * Lightweight RPC fallback for Vault V2 metadata. This should only be used when
 * the primary Morpho API endpoint is unavailable, as it performs direct RPC
 * calls against the current chain.
 */
export async function fetchVaultV2ViaRpc({
  address,
  chainId,
}: {
  address: Address;
  chainId: SupportedNetworks;
}): Promise<VaultV2RpcResult | null> {
  try {
    const client = getClient(chainId);

    const [
      nameResult,
      symbolResult,
      ownerResult,
      curatorResult,
      totalSupplyResult,
      assetResult,
    ] = await Promise.allSettled([
      client.readContract({
        address,
        abi: vaultv2Abi,
        functionName: 'name',
      }),
      client.readContract({
        address,
        abi: vaultv2Abi,
        functionName: 'symbol',
      }),
      client.readContract({
        address,
        abi: vaultv2Abi,
        functionName: 'owner',
      }),
      client.readContract({
        address,
        abi: vaultv2Abi,
        functionName: 'curator',
      }),
      client.readContract({
        address,
        abi: vaultv2Abi,
        functionName: 'totalSupply',
      }),
      client.readContract({
        address,
        abi: vaultv2Abi,
        functionName: 'asset',
      }),
    ]);

    const assetAddress =
      assetResult.status === 'fulfilled'
        ? (assetResult.value as Address)
        : undefined;

    const ownerAddress =
      ownerResult.status === 'fulfilled'
        ? ((ownerResult.value as Address) ?? undefined)
        : undefined;

    const curatorAddress =
      curatorResult.status === 'fulfilled'
        ? ((curatorResult.value as Address) ?? undefined)
        : undefined;

    let assetDecimals: number | undefined;
    if (assetAddress) {
      try {
        const decimals = await client.readContract({
          address: assetAddress,
          abi: erc20Abi,
          functionName: 'decimals',
        });
        assetDecimals = Number(decimals);
      } catch (error) {
        console.error('Failed to read asset decimals via RPC', error);
      }
    }

    return {
      name: nameResult.status === 'fulfilled' ? (nameResult.value as string) : undefined,
      symbol: symbolResult.status === 'fulfilled' ? (symbolResult.value as string) : undefined,
      totalSupply:
        totalSupplyResult.status === 'fulfilled'
          ? (totalSupplyResult.value as bigint)
          : undefined,
      assetAddress,
      assetDecimals,
      owner: ownerAddress,
      curator: curatorAddress,
    };
  } catch (error) {
    console.error('Failed to fetch vault data via RPC fallback', error);
    return null;
  }
}
