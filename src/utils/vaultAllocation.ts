import { maxUint128, type Address } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { formatBalance, formatReadable } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { getClient } from '@/utils/rpc';

export const RELATIVE_CAP_SCALE = 1e16;

export const getVaultReadKey = (address: Address | string, networkId: SupportedNetworks) => `${address.toLowerCase()}-${networkId}`;

/**
 * Calculate allocation percentage relative to total
 */
export function calculateAllocationPercent(amount: bigint, total: bigint): string {
  if (total === 0n) return '0.00';
  const percent = (Number(amount) / Number(total)) * 100;
  return percent.toFixed(2);
}

export function parseRelativeCap(cap: string): number | undefined {
  try {
    return Number(BigInt(cap)) / RELATIVE_CAP_SCALE;
  } catch (_error) {
    return undefined;
  }
}

export function formatVaultAbsoluteCap(cap: string, tokenDecimals: number, tokenSymbol: string): string {
  if (!cap) return 'No absolute cap';

  try {
    const capValue = BigInt(cap);
    if (capValue === 0n || capValue >= maxUint128) return 'No absolute cap';

    const formattedCap = formatReadable(formatBalance(capValue, tokenDecimals).toString());
    return `${formattedCap} ${tokenSymbol}`;
  } catch (_error) {
    return 'No absolute cap';
  }
}

export function hasPositiveVaultCap(cap: { relativeCap: string; absoluteCap: string }): boolean {
  try {
    return BigInt(cap.relativeCap) > 0n || BigInt(cap.absoluteCap) > 0n;
  } catch (_error) {
    return false;
  }
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
  customRpcUrls: CustomRpcUrls = {},
): Promise<Map<string, bigint>> {
  const results = new Map<string, bigint>();
  await Promise.all(
    Object.entries(groupVaultsByNetwork(vaults)).map(async ([chainId, addresses]) => {
      const networkId = Number(chainId) as SupportedNetworks;
      const client = getClient(networkId, customRpcUrls[networkId]);
      const shares = await client.multicall({
        contracts: addresses.map((address) => ({ address, abi: vaultv2Abi, functionName: 'balanceOf', args: [userAddress] }) as const),
        allowFailure: false,
      });
      const heldVaults = addresses.flatMap((address, index) => {
        if (shares[index] > 0n) return [{ address, shares: shares[index] }];
        results.set(getVaultReadKey(address, networkId), 0n);
        return [];
      });
      if (heldVaults.length === 0) return;
      const assets = await client.multicall({
        contracts: heldVaults.map(
          ({ address, shares: balance }) =>
            ({
              address,
              abi: vaultv2Abi,
              functionName: 'previewRedeem',
              args: [balance],
            }) as const,
        ),
        allowFailure: false,
      });
      for (const [index, { address }] of heldVaults.entries()) {
        results.set(getVaultReadKey(address, networkId), assets[index]);
      }
    }),
  );
  return results;
}

export async function fetchVaultTotalAssets(
  vaults: { address: Address; networkId: SupportedNetworks }[],
  customRpcUrls: CustomRpcUrls = {},
): Promise<Map<string, bigint>> {
  const vaultsByNetwork = groupVaultsByNetwork(vaults);
  const results = new Map<string, bigint>();

  await Promise.all(
    Object.entries(vaultsByNetwork).map(async ([networkIdStr, vaultAddresses]) => {
      const networkId = Number(networkIdStr) as SupportedNetworks;
      const client = getClient(networkId, customRpcUrls[networkId]);

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
