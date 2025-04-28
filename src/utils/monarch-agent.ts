import { zeroAddress } from 'viem';
import { SupportedNetworks } from './networks';
import { AgentMetadata } from './types';

export const getAgentContract = (chain: SupportedNetworks) => {
  switch (chain) {
    case SupportedNetworks.Base:
      return '0x6a9BA5c91fDd608b3F85c3E031a4f531f331f545';
    case SupportedNetworks.Polygon:
      return '0x01c90eEb82f982301fE4bd11e36A5704673CF18C';
    default:
      return zeroAddress
  }
};

export enum KnownAgents {
  MAX_APY = '0xe0e04468A54937244BEc3bc6C1CA8Bc36ECE6704',
  // in the future, add more
}

// v1 rebalancer EOA
export const agents: AgentMetadata[] = [
  {
    name: 'Max APY Agent',
    address: KnownAgents.MAX_APY,
    strategyDescription: 'Rebalance every 8 hours, always move to the highest APY',
  },
];

export const findAgent = (address: string): AgentMetadata | undefined => {
  return agents.find((agent) => agent.address.toLowerCase() === address.toLowerCase());
};
