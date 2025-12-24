import type { AgentMetadata } from './types';

const agentApyImage: string = require('@/imgs/agent/agent-apy.png') as string;

export enum KnownAgents {
  MAX_APY = '0x038cC0fFf3aBc20dcd644B1136F42A33df135c52',
}

// v2 rebalancer EOA // identical now
export const v2AgentsBase: AgentMetadata[] = [
  {
    name: 'Max APY Agent',
    address: KnownAgents.MAX_APY,
    strategyDescription: 'Rebalance every 4 hours, distribute funds to get max APY',
    image: agentApyImage,
  },
];

export const findAgent = (address: string): AgentMetadata | undefined => {
  return v2AgentsBase.find((agent) => agent.address.toLowerCase() === address.toLowerCase());
};
