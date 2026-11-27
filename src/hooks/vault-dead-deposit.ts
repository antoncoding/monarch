import { type Address, type PublicClient, encodeFunctionData, erc20Abi } from 'viem';
import { vaultv2Abi } from '@/abis/vaultv2';
import { assertVaultV2CanSeed, fetchVaultV2DeadDeposit } from '@/data-sources/rpc/vault-dead-deposit';
import { VAULT_V2_DEAD_DEPOSIT_RECEIVER } from '@/utils/vaultV2Setup';

export async function prepareVaultV2DeadDeposit({
  client,
  vaultAddress,
  account,
  approve,
}: {
  client: PublicClient;
  vaultAddress: Address;
  account: Address;
  approve: (asset: Address, amount: bigint) => Promise<void>;
}): Promise<`0x${string}`[]> {
  const seed = await fetchVaultV2DeadDeposit(client, vaultAddress);
  assertVaultV2CanSeed(seed);
  if (seed.isSeeded) return [];

  const token = { address: seed.asset, abi: erc20Abi } as const;
  const [allowance, balance, previewAssets] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...token, functionName: 'allowance', args: [account, vaultAddress] },
      { ...token, functionName: 'balanceOf', args: [account] },
      { address: vaultAddress, abi: vaultv2Abi, functionName: 'previewMint', args: [seed.shares] },
    ],
  });
  if (previewAssets !== seed.assets) throw new Error('The initial share price has changed. Review this vault before seeding it.');
  if (balance < seed.assets) throw new Error('Insufficient token balance for the dead deposit. Fund your wallet and try again.');

  // mint has no maxAssets argument. An exact allowance bounds the permanent
  // spend even if the price changes while the wallet prompt is open. Reset an
  // existing allowance first, including for tokens such as USDT.
  if (allowance !== seed.assets) {
    if (allowance > 0n) await approve(seed.asset, 0n);
    await approve(seed.asset, seed.assets);
  }

  // Approval may take several blocks. Never seed an observed non-empty vault,
  // and do not mint twice when setup is resumed after another seed transaction.
  const freshSeed = await fetchVaultV2DeadDeposit(client, vaultAddress);
  assertVaultV2CanSeed(freshSeed);
  if (freshSeed.isSeeded) return [];

  const [confirmedAllowance, freshPreviewAssets] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...token, functionName: 'allowance', args: [account, vaultAddress] },
      { address: vaultAddress, abi: vaultv2Abi, functionName: 'previewMint', args: [seed.shares] },
    ],
  });
  if (confirmedAllowance !== seed.assets) throw new Error('Approve exactly the dead deposit amount before completing setup.');
  if (freshPreviewAssets !== seed.assets) throw new Error('The initial share price has changed. Review this vault before seeding it.');

  return [encodeFunctionData({ abi: vaultv2Abi, functionName: 'mint', args: [seed.shares, VAULT_V2_DEAD_DEPOSIT_RECEIVER] })];
}
