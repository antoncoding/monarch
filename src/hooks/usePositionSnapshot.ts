import { useCallback } from 'react';
import { Address } from 'viem';

export type PositionSnapshot = {
  supplyAssets: string;
  supplyShares: string;
  borrowAssets: string;
  borrowShares: string;
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
      blockNumber: number,
    ): Promise<PositionSnapshot | null> => {
      try {
        // Then, fetch the position at that block number
        const positionResponse = await fetch(
          `/api/positions/historical?` +
            `marketId=${encodeURIComponent(marketId)}` +
            `&userAddress=${encodeURIComponent(userAddress)}` +
            `&blockNumber=${encodeURIComponent(blockNumber)}` +
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
          };
        }

        console.log('Position snapshot response:', positionData);

        return {
          ...positionData.position,
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
