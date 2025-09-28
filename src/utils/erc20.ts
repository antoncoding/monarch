import { Address, erc20Abi } from 'viem';
import { SupportedNetworks } from './networks';
import { getClient } from './rpc';

export async function getERC20Balance(
  asset: Address,
  account: Address,
  networkId: SupportedNetworks
): Promise<bigint | null> {
  try {

    const client = getClient(networkId)
    const balance = await client.readContract({
      address: asset,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    });

    return balance;
  } catch (error) {
    console.error(
      `Error reading ERC20 balance for ${asset} on network ${networkId}:`,
      error
    );
    return null;
  }
}