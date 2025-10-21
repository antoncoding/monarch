import { Address } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

/**
 * Read the current allocation amount for a specific cap ID from the vault contract
 */
export async function readAllocation(
  vaultAddress: Address,
  capId: `0x${string}`,
  chainId: SupportedNetworks,
): Promise<bigint> {
  try {
    const client = getClient(chainId);
    const amount = await client.readContract({
      address: vaultAddress,
      abi: vaultv2Abi,
      functionName: 'allocation',
      args: [capId],
    });

    return amount as bigint;
  } catch (error) {
    console.error(`Failed to read allocation for capId ${capId}:`, error);
    return 0n;
  }
}

/**
 * Format allocation amount with proper decimals and locale formatting
 */
export function formatAllocationAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) return '0';
  const value = Number(amount) / 10 ** decimals;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

/**
 * Calculate allocation percentage relative to total
 */
export function calculateAllocationPercent(amount: bigint, total: bigint): string {
  if (total === 0n) return '0.00';
  const percent = (Number(amount) / Number(total)) * 100;
  return percent.toFixed(2);
}
