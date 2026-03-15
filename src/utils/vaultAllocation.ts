import type { Address } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

export const getVaultReadKey = (address: Address | string, networkId: SupportedNetworks) => `${address.toLowerCase()}-${networkId}`;

/**
 * Calculate allocation percentage relative to total
 */
export function calculateAllocationPercent(amount: bigint, total: bigint): string {
  if (total === 0n) return '0.00';
  const percent = (Number(amount) / Number(total)) * 100;
  return percent.toFixed(2);
}

const groupVaultsByNetwork = (vaults: { address: Address; networkId: SupportedNetworks }[]): Record<SupportedNetworks, Address[]> => {
  return vaults.reduce(
    (acc, vault) => {
      if (!acc[vault.networkId]) {
        acc[vault.networkId] = [];
      }
      acc[vault.networkId].push(vault.address);
      return acc;
    },
    {} as Record<SupportedNetworks, Address[]>,
  );
};

/**
 * Batch fetch user's vault shares and convert to redeemable assets
 * @param vaults - Array of vaults with address and networkId
 * @param userAddress - User's address
 * @returns Map of vault address to redeemable assets (previewRedeem result)
 */
export async function fetchUserVaultShares(
  vaults: { address: Address; networkId: SupportedNetworks }[],
  userAddress: Address,
): Promise<Map<string, bigint>> {
  // Group vaults by network for efficient batching
  const vaultsByNetwork = groupVaultsByNetwork(vaults);

  const results = new Map<string, bigint>();

  // Process each network in parallel
  await Promise.all(
    Object.entries(vaultsByNetwork).map(async ([networkIdStr, vaultAddresses]) => {
      const networkId = Number(networkIdStr) as SupportedNetworks;
      const client = getClient(networkId);

      try {
        // Step 1: Batch fetch balanceOf for all vaults
        const balanceContracts = vaultAddresses.map((vaultAddress) => ({
          address: vaultAddress,
          abi: vaultv2Abi,
          functionName: 'balanceOf' as const,
          args: [userAddress],
        }));

        const balanceResults = await client.multicall({
          contracts: balanceContracts,
          allowFailure: true,
        });

        // Step 2: Batch fetch previewRedeem for vaults with non-zero balance
        const redeemContracts = vaultAddresses
          .map((vaultAddress, index) => {
            const balanceResult = balanceResults[index];
            if (balanceResult.status === 'success' && balanceResult.result) {
              const shares = balanceResult.result as bigint;
              if (shares > 0n) {
                return {
                  address: vaultAddress,
                  abi: vaultv2Abi,
                  functionName: 'previewRedeem' as const,
                  args: [shares],
                  _vaultAddress: vaultAddress,
                };
              }
            }
            return null;
          })
          .filter((c) => c !== null);

        if (redeemContracts.length === 0) {
          // No vaults with balance, return zeros
          vaultAddresses.forEach((addr) => {
            results.set(getVaultReadKey(addr, networkId), 0n);
          });
          return;
        }

        const redeemResults = await client.multicall({
          contracts: redeemContracts.map((c) => ({
            address: c!.address,
            abi: c!.abi,
            functionName: c!.functionName,
            args: c!.args,
          })),
          allowFailure: true,
        });

        // Map results back to vault addresses
        redeemContracts.forEach((contract, index) => {
          if (contract) {
            const result = redeemResults[index];
            const vaultAddress = getVaultReadKey(contract._vaultAddress, networkId);
            if (result.status === 'success' && result.result) {
              results.set(vaultAddress, result.result as bigint);
            } else {
              results.set(vaultAddress, 0n);
            }
          }
        });

        // Set 0 for vaults that had 0 balance
        vaultAddresses.forEach((addr) => {
          const vaultKey = getVaultReadKey(addr, networkId);
          if (!results.has(vaultKey)) {
            results.set(vaultKey, 0n);
          }
        });
      } catch (error) {
        console.error(`Failed to fetch vault shares for network ${networkId}:`, error);
        // Set all to 0 on error
        vaultAddresses.forEach((addr) => {
          results.set(getVaultReadKey(addr, networkId), 0n);
        });
      }
    }),
  );

  return results;
}

export async function fetchVaultTotalAssets(vaults: { address: Address; networkId: SupportedNetworks }[]): Promise<Map<string, bigint>> {
  const vaultsByNetwork = groupVaultsByNetwork(vaults);
  const results = new Map<string, bigint>();

  await Promise.all(
    Object.entries(vaultsByNetwork).map(async ([networkIdStr, vaultAddresses]) => {
      const networkId = Number(networkIdStr) as SupportedNetworks;
      const client = getClient(networkId);

      try {
        const totalAssetsResults = await client.multicall({
          contracts: vaultAddresses.map((vaultAddress) => ({
            address: vaultAddress,
            abi: vaultv2Abi,
            functionName: 'totalAssets' as const,
            args: [],
          })),
          allowFailure: true,
        });

        vaultAddresses.forEach((vaultAddress, index) => {
          const result = totalAssetsResults[index];
          if (result.status === 'success' && typeof result.result === 'bigint') {
            results.set(getVaultReadKey(vaultAddress, networkId), result.result);
          }
        });
      } catch (error) {
        console.error(`Failed to fetch vault total assets for network ${networkId}:`, error);
      }
    }),
  );

  return results;
}
