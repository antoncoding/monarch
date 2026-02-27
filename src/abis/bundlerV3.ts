import type { Abi } from 'viem';

/**
 * Minimal Bundler3 ABI for multicall + callback reentry.
 */
export const bundlerV3Abi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'callbackHash',
    inputs: [{ internalType: 'bytes', name: 'data', type: 'bytes' }],
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'initiator',
    inputs: [],
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'reenterHash',
    inputs: [],
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    stateMutability: 'payable',
    name: 'multicall',
    inputs: [
      {
        internalType: 'struct Call[]',
        name: 'bundle',
        type: 'tuple[]',
        components: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'skipRevert',
            type: 'bool',
          },
          {
            internalType: 'bytes32',
            name: 'callbackHash',
            type: 'bytes32',
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'reenter',
    inputs: [
      {
        internalType: 'struct Call[]',
        name: 'bundle',
        type: 'tuple[]',
        components: [
          {
            internalType: 'address',
            name: 'to',
            type: 'address',
          },
          {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes',
          },
          {
            internalType: 'uint256',
            name: 'value',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'skipRevert',
            type: 'bool',
          },
          {
            internalType: 'bytes32',
            name: 'callbackHash',
            type: 'bytes32',
          },
        ],
      },
    ],
    outputs: [],
  },
] as const satisfies Abi;
