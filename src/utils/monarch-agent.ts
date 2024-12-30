import { AgentMetadata } from './types';

export const AGENT_CONTRACT = '0x6a9BA5c91fDd608b3F85c3E031a4f531f331f545';

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
