import type { Abi } from 'viem';

const marketParamsTuple = {
  internalType: 'struct MarketParams',
  name: 'marketParams',
  type: 'tuple',
  components: [
    { internalType: 'address', name: 'loanToken', type: 'address' },
    { internalType: 'address', name: 'collateralToken', type: 'address' },
    { internalType: 'address', name: 'oracle', type: 'address' },
    { internalType: 'address', name: 'irm', type: 'address' },
    { internalType: 'uint256', name: 'lltv', type: 'uint256' },
  ],
} as const;

/**
 * Minimal GeneralAdapter1 ABI needed for swap-backed leverage.
 */
export const morphoGeneralAdapterV1Abi = [
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
    name: 'erc20TransferFrom',
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
    name: 'permit2TransferFrom',
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
    name: 'morphoSupplyCollateral',
    inputs: [
      marketParamsTuple,
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'morphoBorrow',
    inputs: [
      marketParamsTuple,
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'uint256', name: 'shares', type: 'uint256' },
      { internalType: 'uint256', name: 'minSharePriceE27', type: 'uint256' },
      { internalType: 'address', name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'morphoRepay',
    inputs: [
      marketParamsTuple,
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'uint256', name: 'shares', type: 'uint256' },
      { internalType: 'uint256', name: 'maxSharePriceE27', type: 'uint256' },
      { internalType: 'address', name: 'onBehalf', type: 'address' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'morphoWithdrawCollateral',
    inputs: [
      marketParamsTuple,
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'address', name: 'receiver', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'morphoFlashLoan',
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'uint256', name: 'assets', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
] as const satisfies Abi;
