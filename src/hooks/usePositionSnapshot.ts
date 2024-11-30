import { useCallback } from 'react';
import { Address } from 'viem';

export type PositionSnapshot = {
  supplyAssets: string;
  supplyShares: string;
  borrowAssets: string;
  borrowShares: string;
  timestamp: number;
};

type ApiResponse = {
  position: {
    supplyAssets: string;
    supplyShares: string;
    borrowAssets: string;
    borrowShares: string;
    timestamp: number;
  } | null;
};

export function usePositionSnapshot() {
  const fetchPositionSnapshot = useCallback(async (
    marketId: string,
    userAddress: Address,
    chainId: number,
    timestamp: number
  ): Promise<PositionSnapshot | null> => {
    try {
      console.log('Fetching position snapshot...', {
        marketId,
        userAddress,
        timestamp,
        chainId   
      });

      const response = await fetch(
        `/api/positions/historical?` +
        `marketId=${encodeURIComponent(marketId)}` +
        `&userAddress=${encodeURIComponent(userAddress)}` +
        `&timestamp=${encodeURIComponent(timestamp)}` +
        `&chainId=${encodeURIComponent(chainId)}`
      );

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        console.error('Failed to fetch position snapshot:', errorData);
        return null;
      }

      const data = await response.json() as ApiResponse;
      
      // If position is empty, return zeros
      if (!data.position) {
        return {
          supplyAssets: '0',
          supplyShares: '0',
          borrowAssets: '0',
          borrowShares: '0',
          timestamp: timestamp
        };
      }

      console.log('Position snapshot response:', data);

      return {
        supplyAssets: data.position.supplyAssets,
        supplyShares: data.position.supplyShares,
        borrowAssets: data.position.borrowAssets,
        borrowShares: data.position.borrowShares,
        timestamp: data.position.timestamp
      };
    } catch (error) {
      console.error('Error fetching position snapshot:', error);
      return null;
    }
  }, []);

  return { fetchPositionSnapshot };
}
