import type { Abi } from 'viem';

/**
 * Minimal ParaswapAdapter ABI for Bundler3 swap legs.
 */
export const paraswapAdapterAbi = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'erc20Transfer',
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'receiver', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'sell',
    inputs: [
      { internalType: 'address', name: 'augustus', type: 'address' },
      { internalType: 'bytes', name: 'callData', type: 'bytes' },
      { internalType: 'address', name: 'srcToken', type: 'address' },
      { internalType: 'address', name: 'destToken', type: 'address' },
      { internalType: 'bool', name: 'sellEntireBalance', type: 'bool' },
      {
        components: [
          { internalType: 'uint256', name: 'exactAmount', type: 'uint256' },
          { internalType: 'uint256', name: 'limitAmount', type: 'uint256' },
          { internalType: 'uint256', name: 'quotedAmount', type: 'uint256' },
        ],
        internalType: 'struct Offsets',
        name: 'offsets',
        type: 'tuple',
      },
      { internalType: 'address', name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
] as const satisfies Abi;
