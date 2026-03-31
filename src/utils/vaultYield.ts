import type { Address } from 'viem';
import { erc4626Abi } from '@/abis/erc4626';
import { computeAnnualizedApyFromGrowth } from '@/utils/rateMath';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { getVaultReadKey } from '@/utils/vaultAllocation';

export const DEFAULT_VAULT_APY_LOOKBACK_DAYS = 3;
const SECONDS_PER_DAY = 24 * 60 * 60;

export type VaultYieldRequest = {
  address: Address;
  networkId: SupportedNetworks;
};

export type VaultYieldSnapshot = {
  vaultApy: number | null;
  sharePriceNow: bigint | null;
  periodSeconds: number | null;
  currentBlock: bigint | null;
  pastBlock: bigint | null;
};

const buildNullSnapshot = (): VaultYieldSnapshot => ({
  vaultApy: null,
  sharePriceNow: null,
  periodSeconds: null,
  currentBlock: null,
  pastBlock: null,
});

const setNetworkResults = (
  results: Map<string, VaultYieldSnapshot>,
  vaults: VaultYieldRequest[],
  networkId: SupportedNetworks,
  snapshotFactory: () => VaultYieldSnapshot,
): void => {
  for (const vault of vaults) {
    results.set(getVaultReadKey(vault.address, networkId), snapshotFactory());
  }
};

export async function fetchVaultYieldSnapshots({
  vaults,
  lookbackDays = DEFAULT_VAULT_APY_LOOKBACK_DAYS,
  customRpcUrls,
  throwOnFailure = false,
}: {
  vaults: VaultYieldRequest[];
  lookbackDays?: number;
  customRpcUrls?: Partial<Record<SupportedNetworks, string | undefined>>;
  throwOnFailure?: boolean;
}): Promise<Map<string, VaultYieldSnapshot>> {
  const results = new Map<string, VaultYieldSnapshot>();

  if (vaults.length === 0) {
    return results;
  }

  const vaultsByNetwork = vaults.reduce(
    (acc, vault) => {
      const existing = acc[vault.networkId] ?? [];
      existing.push(vault);
      acc[vault.networkId] = existing;
      return acc;
    },
    {} as Record<SupportedNetworks, VaultYieldRequest[]>,
  );

  await Promise.all(
    Object.entries(vaultsByNetwork).map(async ([networkIdValue, networkVaults]) => {
      const networkId = Number(networkIdValue) as SupportedNetworks;

      try {
        const client = getClient(networkId, customRpcUrls?.[networkId]);
        const currentBlock = await client.getBlockNumber();
        const currentBlockData = await client.getBlock({ blockNumber: currentBlock });
        const currentTimestamp = Number(currentBlockData.timestamp);

        const targetTimestamp = currentTimestamp - lookbackDays * SECONDS_PER_DAY;
        const estimatedPastBlock = BigInt(estimateBlockAtTimestamp(networkId, targetTimestamp, Number(currentBlock), currentTimestamp));
        const pastBlockData = await client.getBlock({ blockNumber: estimatedPastBlock });
        const pastTimestamp = Number(pastBlockData.timestamp);
        const periodSeconds = currentTimestamp - pastTimestamp;

        if (periodSeconds <= 0) {
          setNetworkResults(results, networkVaults, networkId, buildNullSnapshot);
          return;
        }

        const decimalsResults = await client.multicall({
          contracts: networkVaults.map((vault) => ({
            address: vault.address,
            abi: erc4626Abi,
            functionName: 'decimals' as const,
            args: [],
          })),
          allowFailure: true,
        });

        const previewableVaults = networkVaults
          .map((vault, index) => {
            const decimalsResult = decimalsResults[index];
            if (decimalsResult?.status !== 'success' || typeof decimalsResult.result !== 'number') {
              return null;
            }

            return {
              ...vault,
              oneShareUnit: 10n ** BigInt(decimalsResult.result),
            };
          })
          .filter((vault): vault is VaultYieldRequest & { oneShareUnit: bigint } => vault !== null);

        const baseSnapshot = {
          currentBlock,
          pastBlock: estimatedPastBlock,
          periodSeconds,
        } satisfies Pick<VaultYieldSnapshot, 'currentBlock' | 'pastBlock' | 'periodSeconds'>;

        setNetworkResults(results, networkVaults, networkId, () => ({
          ...buildNullSnapshot(),
          ...baseSnapshot,
        }));

        if (previewableVaults.length === 0) {
          return;
        }

        const previewContracts = previewableVaults.map((vault) => ({
          address: vault.address,
          abi: erc4626Abi,
          functionName: 'previewRedeem' as const,
          args: [vault.oneShareUnit] as const,
        }));

        const currentPreviewResults = await client.multicall({
          contracts: previewContracts,
          allowFailure: true,
          blockNumber: currentBlock,
        });

        let pastPreviewResults: typeof currentPreviewResults | null = null;
        try {
          pastPreviewResults = await client.multicall({
            contracts: previewContracts,
            allowFailure: true,
            blockNumber: estimatedPastBlock,
          });
        } catch {
          // Some RPCs do not support archive eth_call on historical blocks.
          pastPreviewResults = null;
        }

        previewableVaults.forEach((vault, index) => {
          const currentPreviewResult = currentPreviewResults[index];
          const sharePriceNow =
            currentPreviewResult?.status === 'success' && typeof currentPreviewResult.result === 'bigint'
              ? currentPreviewResult.result
              : null;
          const pastPreviewResult = pastPreviewResults?.[index];
          const pastSharePrice =
            pastPreviewResult?.status === 'success' && typeof pastPreviewResult.result === 'bigint' ? pastPreviewResult.result : null;

          const vaultApy =
            sharePriceNow && pastSharePrice
              ? computeAnnualizedApyFromGrowth({
                  currentValue: sharePriceNow,
                  pastValue: pastSharePrice,
                  periodSeconds,
                })
              : null;

          results.set(getVaultReadKey(vault.address, networkId), {
            vaultApy,
            sharePriceNow,
            periodSeconds,
            currentBlock,
            pastBlock: estimatedPastBlock,
          });
        });
      } catch (error) {
        if (throwOnFailure) {
          throw error;
        }

        console.warn(`[vaultYield] Failed to fetch vault yield snapshots for chain ${networkId}:`, error);
        setNetworkResults(results, networkVaults, networkId, buildNullSnapshot);
      }
    }),
  );

  return results;
}
