import { createPublicClient, http } from 'viem';
import { base, mainnet } from 'viem/chains';
import { SupportedNetworks } from './networks';

// Initialize Alchemy clients for each chain
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
});

export const baseClient = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
});

export const BLOCK_TIME = {
  [SupportedNetworks.Mainnet]: 12, // Ethereum mainnet: 12 seconds
  [SupportedNetworks.Base]: 2, // Base: 2 seconds
} as const;

export const GENESIS_BLOCK = {
  [SupportedNetworks.Mainnet]: 18883124, // Ethereum mainnet
  [SupportedNetworks.Base]: 13977148, // Base
} as const;
