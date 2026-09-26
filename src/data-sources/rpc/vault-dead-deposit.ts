import { type Address, type PublicClient, erc20Abi } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { getVaultV2DeadDepositAmounts, VAULT_V2_DEAD_DEPOSIT_RECEIVER } from '@/utils/vaultV2Setup';

export async function fetchVaultV2DeadDeposit(client: PublicClient, vaultAddress: Address) {
  // Keep the seed eligibility and its price on one fresh snapshot. Failed reads
  // must not be interpreted as an empty vault.
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const contract = { address: vaultAddress, abi: vaultv2Abi } as const;
  const [asset, totalSupply, deadShares, totalAssets] = await client.multicall({
    allowFailure: false,
    blockNumber,
    contracts: [
      { ...contract, functionName: 'asset' },
      { ...contract, functionName: 'totalSupply' },
      { ...contract, functionName: 'balanceOf', args: [VAULT_V2_DEAD_DEPOSIT_RECEIVER] },
      { ...contract, functionName: 'totalAssets' },
    ],
  });
  const assetDecimals = await client.readContract({ address: asset, abi: erc20Abi, functionName: 'decimals', blockNumber });
  const { shares, assets } = getVaultV2DeadDepositAmounts(assetDecimals);

  return { asset, assetDecimals, shares, assets, totalSupply, totalAssets, isSeeded: deadShares >= shares };
}

export type VaultV2DeadDeposit = Awaited<ReturnType<typeof fetchVaultV2DeadDeposit>>;

export function assertVaultV2CanSeed(seed: VaultV2DeadDeposit) {
  if (!seed.isSeeded && (seed.totalSupply !== 0n || seed.totalAssets !== 0n)) {
    throw new Error('This vault already has deposits without the required dead shares. Review its deposit history before proceeding.');
  }
}
