import { useCallback } from 'react';
import { Address } from 'viem';

export type PositionSnapshot = {
  supplyAssets: string;
  supplyShares: string;
  borrowAssets: string;
  borrowShares: string;
  timestamp: number;
};

type BlockResponse = {
  blockNumber: string;
  timestamp: number;
  approximateBlockTime: number;
};

type PositionResponse = {
  position: {
    supplyAssets: string;
    supplyShares: string;
    borrowAssets: string;
    borrowShares: string;
  } | null;
};

export function usePositionSnapshot() {
  const fetchPositionSnapshot = useCallback(
    async (
      marketId: string,
      userAddress: Address,
      chainId: number,
      timestamp: number,
    ): Promise<PositionSnapshot | null> => {
      try {
        console.log('Finding nearest block...', {
          timestamp,
          chainId,
        });

        // First, get the nearest block number for the timestamp
        const blockResponse = await fetch(
          `/api/block?` +
            `timestamp=${encodeURIComponent(timestamp)}` +
            `&chainId=${encodeURIComponent(chainId)}`,
        );

        if (!blockResponse.ok) {
          const errorData = (await blockResponse.json()) as { error?: string };
          console.error('Failed to find nearest block:', errorData);
          return null;
        }

        const blockData = (await blockResponse.json()) as BlockResponse;
        console.log('Found nearest block:', blockData);

        // Then, fetch the position at that block number
        const positionResponse = await fetch(
          `/api/positions/historical?` +
            `marketId=${encodeURIComponent(marketId)}` +
            `&userAddress=${encodeURIComponent(userAddress)}` +
            `&blockNumber=${encodeURIComponent(blockData.blockNumber)}` +
            `&chainId=${encodeURIComponent(chainId)}`,
        );

        if (!positionResponse.ok) {
          const errorData = (await positionResponse.json()) as { error?: string };
          console.error('Failed to fetch position snapshot:', errorData);
          return null;
        }

        const positionData = (await positionResponse.json()) as PositionResponse;

        // If position is empty, return zeros
        if (!positionData.position) {
          return {
            supplyAssets: '0',
            supplyShares: '0',
            borrowAssets: '0',
            borrowShares: '0',
            timestamp: blockData.timestamp,
          };
        }

        console.log('Position snapshot response:', positionData);

        return {
          ...positionData.position,
          timestamp: blockData.timestamp,
        };
      } catch (error) {
        console.error('Error fetching position snapshot:', error);
        return null;
      }
    },
    [],
  );

  return { fetchPositionSnapshot };
}
