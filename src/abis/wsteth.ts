import type { Abi } from 'viem';

/**
 * Minimal wstETH ABI surface required for V2 stETH leverage/deleverage routing.
 */
export const wstEthAbi = [
  {
    inputs: [],
    name: 'stETH',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_wstETHAmount', type: 'uint256' }],
    name: 'getStETHByWstETH',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_stETHAmount', type: 'uint256' }],
    name: 'getWstETHByStETH',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi;
