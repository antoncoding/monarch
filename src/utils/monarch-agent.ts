import { zeroAddress } from 'viem';
import type { AgentMetadata } from './types';

const agentApyImage: string = require('@/imgs/agent/agent-apy.png') as string;

export enum KnownAgents {
  MAX_APY = '0x038cC0fFf3aBc20dcd644B1136F42A33df135c52',
  MAX_APY_HOURLY = '0xC953bc5F74a6b3F3c7e3539390116A233CE92108',
}

// Performance fee constants (WAD format: 1e18 = 100%)
const PERFORMANCE_FEE_10_PERCENT = 100000000000000000n; // 0.1e18 = 10%

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
  {
    name: 'Rapid Max APY',
    address: KnownAgents.MAX_APY_HOURLY,
    strategyDescription: 'Rebalances every 5 minutes if necessary, optimizing for highest APY considering all managed auto vaults.',
    image: agentApyImage,
    performanceFee: PERFORMANCE_FEE_10_PERCENT,
    performanceFeeRecipient: KnownAgents.MAX_APY_HOURLY,
  },
];

export const findAgent = (address: string): AgentMetadata | undefined => {
  return v2AgentsBase.find((agent) => agent.address.toLowerCase() === address.toLowerCase());
};
