import { createPublicClient, http, Address } from 'viem';
import { getViemChain, getDefaultRPC, SupportedNetworks } from '@/utils/networks';

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

type TokenBalance = {
  address: string;
  balance: string;
};

/**
 * Fetches ERC20 token balances for a given address on HyperEVM by directly calling balanceOf on each token contract
 */
export async function getHyperEVMBalances(
  userAddress: string,
  tokenAddresses: string[],
): Promise<TokenBalance[]> {
  const client = createPublicClient({
    chain: getViemChain(SupportedNetworks.HyperEVM),
    transport: http(getDefaultRPC(SupportedNetworks.HyperEVM)),
  });

  // Create multicall contracts for all token addresses
  const contracts = tokenAddresses.map((tokenAddress) => ({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress as Address],
  }));

  try {
    // Use multicall to batch all balance queries into a single RPC call
    const results = await client.multicall({
      contracts,
      allowFailure: true,
    });

    // Filter out failed calls and zero balances, then format the response
    const tokens: TokenBalance[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.status === 'success' && result.result !== undefined) {
        const balance = result.result as bigint;

        // Only include non-zero balances
        if (balance > 0n) {
          tokens.push({
            address: tokenAddresses[i].toLowerCase(),
            balance: balance.toString(10),
          });
        }
      }
    }

    return tokens;
  } catch (error) {
    console.error('Failed to fetch HyperEVM balances via multicall:', error);
    throw new Error('Failed to fetch balances from HyperEVM');
  }
}
