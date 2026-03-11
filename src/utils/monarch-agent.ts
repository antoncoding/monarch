import { zeroAddress } from 'viem';
import type { AgentMetadata } from './types';

const agentApyImage: string = require('@/imgs/agent/agent-apy.png') as string;

export enum KnownAgents {
  MAX_APY = '0x038cC0fFf3aBc20dcd644B1136F42A33df135c52',
}

// v2 rebalancer EOA // identical now
export const v2AgentsBase: AgentMetadata[] = [
  {
    name: 'Chill APY Agent',
    address: KnownAgents.MAX_APY,
    strategyDescription: 'Rebalances every 4 hours. Finds highest APY for each vault independently.',
    image: agentApyImage,
    performanceFee: 0n,
    performanceFeeRecipient: zeroAddress,
  },
];

export const findAgent = (address: string): AgentMetadata | undefined => {
  return v2AgentsBase.find((agent) => agent.address.toLowerCase() === address.toLowerCase());
};
