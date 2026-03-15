import type { Abi } from 'viem';

export const adapterV2FactoryAbi = [
  {
    inputs: [{ internalType: 'address', name: 'parentVault', type: 'address' }],
    name: 'createMorphoMarketV1AdapterV2',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const satisfies Abi;
