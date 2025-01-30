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

export const LATEST_BLOCK_DELAY = {
  [SupportedNetworks.Mainnet]: 0, // Ethereum mainnet
  [SupportedNetworks.Base]: 20, // Base
};

type BlockResponse = {
  blockNumber: string;
  timestamp: number;
  approximateBlockTime: number;
};

export async function estimatedBlockNumber(
  chainId: SupportedNetworks,
  timestamp: number,
): Promise<{
  blockNumber: number;
  timestamp: number;
}> {
  const fetchBlock = async () => {
    const blockResponse = await fetch(
      `/api/block?` +
        `timestamp=${encodeURIComponent(timestamp)}` +
        `&chainId=${encodeURIComponent(chainId)}`,
    );

    if (!blockResponse.ok) {
      const errorData = (await blockResponse.json()) as { error?: string };
      console.error('Failed to find nearest block:', errorData);
      throw new Error('Failed to find nearest block');
    }

    const blockData = (await blockResponse.json()) as BlockResponse;
    console.log('Found nearest block:', blockData);

    return {
      blockNumber: Number(blockData.blockNumber),
      timestamp: Number(blockData.timestamp),
    };
  };

  try {
    return await fetchBlock();
  } catch (error) {
    console.log('First attempt failed, retrying in 2 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await fetchBlock();
  }
}
