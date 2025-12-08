import { zeroAddress } from 'viem';
import { SupportedNetworks } from './networks';
import type { AgentMetadata } from './types';

const agentApyImage: string = require('@/imgs/agent/agent-apy.png') as string;

// todo: remove this after v2 agent config refactor
export const getAgentContract = (chain: SupportedNetworks) => {
  switch (chain) {
    case SupportedNetworks.Base:
      return '0x6a9BA5c91fDd608b3F85c3E031a4f531f331f545';
    case SupportedNetworks.Polygon:
      return '0x01c90eEb82f982301fE4bd11e36A5704673CF18C';
    default:
      return zeroAddress;
  }
};

export enum KnownAgents {
  MAX_APY = '0x038cC0fFf3aBc20dcd644B1136F42A33df135c52',
}

// v2 rebalancer EOA // identical now
export const v2AgentsBase: AgentMetadata[] = [
  {
    name: 'Max APY Agent',
    address: KnownAgents.MAX_APY,
    strategyDescription: 'Rebalance every 8 hours, always move to the highest APY',
    image: agentApyImage,
  },
];

export const findAgent = (address: string): AgentMetadata | undefined => {
  return v2AgentsBase.find((agent) => agent.address.toLowerCase() === address.toLowerCase());
};
