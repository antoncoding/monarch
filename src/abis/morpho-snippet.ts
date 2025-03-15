export const abi = [
  {
    inputs: [{ internalType: 'address', name: 'morphoAddress', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint128', name: 'totalSupplyAssets', type: 'uint128' },
          { internalType: 'uint128', name: 'totalSupplyShares', type: 'uint128' },
          { internalType: 'uint128', name: 'totalBorrowAssets', type: 'uint128' },
          { internalType: 'uint128', name: 'totalBorrowShares', type: 'uint128' },
          { internalType: 'uint128', name: 'lastUpdate', type: 'uint128' },
          { internalType: 'uint128', name: 'fee', type: 'uint128' },
        ],
        internalType: 'struct Market',
        name: 'market',
        type: 'tuple',
      },
    ],
    name: 'borrowAPY',
    outputs: [{ internalType: 'uint256', name: 'borrowApy', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'borrowAssetsUser',
    outputs: [{ internalType: 'uint256', name: 'totalBorrowAssets', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'Id', name: 'marketId', type: 'bytes32' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'collateralAssetsUser',
    outputs: [{ internalType: 'uint256', name: 'totalCollateralAssets', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
    ],
    name: 'marketTotalBorrow',
    outputs: [{ internalType: 'uint256', name: 'totalBorrowAssets', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
    ],
    name: 'marketTotalSupply',
    outputs: [{ internalType: 'uint256', name: 'totalSupplyAssets', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'morpho',
    outputs: [{ internalType: 'contract IMorpho', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'uint128', name: 'totalSupplyAssets', type: 'uint128' },
          { internalType: 'uint128', name: 'totalSupplyShares', type: 'uint128' },
          { internalType: 'uint128', name: 'totalBorrowAssets', type: 'uint128' },
          { internalType: 'uint128', name: 'totalBorrowShares', type: 'uint128' },
          { internalType: 'uint128', name: 'lastUpdate', type: 'uint128' },
          { internalType: 'uint128', name: 'fee', type: 'uint128' },
        ],
        internalType: 'struct Market',
        name: 'market',
        type: 'tuple',
      },
    ],
    name: 'supplyAPY',
    outputs: [{ internalType: 'uint256', name: 'supplyApy', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'supplyAssetsUser',
    outputs: [{ internalType: 'uint256', name: 'totalSupplyAssets', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'loanToken', type: 'address' },
          { internalType: 'address', name: 'collateralToken', type: 'address' },
          { internalType: 'address', name: 'oracle', type: 'address' },
          { internalType: 'address', name: 'irm', type: 'address' },
          { internalType: 'uint256', name: 'lltv', type: 'uint256' },
        ],
        internalType: 'struct MarketParams',
        name: 'marketParams',
        type: 'tuple',
      },
      { internalType: 'Id', name: 'id', type: 'bytes32' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'userHealthFactor',
    outputs: [{ internalType: 'uint256', name: 'healthFactor', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];
