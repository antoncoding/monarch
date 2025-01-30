import { NextRequest, NextResponse } from 'next/server';
import { Address } from 'viem';
import morphoABI from '@/abis/morpho';
import { MORPHO } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { baseClient, mainnetClient } from '@/utils/rpc';

// Types
type Position = {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
};

type Market = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

// Helper functions
function arrayToPosition(arr: readonly bigint[]): Position {
  return {
    supplyShares: arr[0],
    borrowShares: arr[1],
    collateral: arr[2],
  };
}

function arrayToMarket(arr: readonly bigint[]): Market {
  return {
    totalSupplyAssets: arr[0],
    totalSupplyShares: arr[1],
    totalBorrowAssets: arr[2],
    totalBorrowShares: arr[3],
    lastUpdate: arr[4],
    fee: arr[5],
  };
}

function convertSharesToAssets(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  if (totalShares === 0n) return 0n;
  return (shares * totalAssets) / totalShares;
}

async function getPositionAtBlock(
  marketId: string,
  userAddress: string,
  blockNumber: number,
  chainId: number,
) {
  console.log(`Get user position ${marketId.slice(0, 6)} at blockNumber ${blockNumber}`);

  const client = chainId === SupportedNetworks.Mainnet ? mainnetClient : baseClient;
  if (!client) throw new Error(`Unsupported chain ID: ${chainId}`);

  try {
    // First get the position data
    const positionArray = (await client.readContract({
      address: MORPHO,
      abi: morphoABI,
      functionName: 'position',
      args: [marketId as `0x${string}`, userAddress as Address],
      blockNumber: BigInt(blockNumber),
    })) as readonly bigint[];

    // Convert array to position object
    const position = arrayToPosition(positionArray);

    // If position has no shares, return zeros early
    if (
      position.supplyShares === 0n &&
      position.borrowShares === 0n &&
      position.collateral === 0n
    ) {
      // console.log('Position has no shares, returning zeros');
      return {
        supplyShares: '0',
        supplyAssets: '0',
        borrowShares: '0',
        borrowAssets: '0',
        collateral: '0',
      };
    }

    // Only fetch market data if position has shares
    const marketArray = (await client.readContract({
      address: MORPHO,
      abi: morphoABI,
      functionName: 'market',
      args: [marketId as `0x${string}`],
      blockNumber: BigInt(blockNumber),
    })) as readonly bigint[];

    // Convert array to market object
    const market = arrayToMarket(marketArray);

    // Convert shares to assets
    const supplyAssets = convertSharesToAssets(
      position.supplyShares,
      market.totalSupplyAssets,
      market.totalSupplyShares,
    );

    const borrowAssets = convertSharesToAssets(
      position.borrowShares,
      market.totalBorrowAssets,
      market.totalBorrowShares,
    );

    // console.log(`Successfully retrieved position data:`, {
    //   marketId,
    //   userAddress,
    //   blockNumber,
    //   supplyShares: position.supplyShares.toString(),
    //   supplyAssets: supplyAssets.toString(),
    //   borrowShares: position.borrowShares.toString(),
    //   borrowAssets: borrowAssets.toString(),
    //   collateral: position.collateral.toString(),
    //   market: {
    //     totalSupplyAssets: market.totalSupplyAssets.toString(),
    //     totalSupplyShares: market.totalSupplyShares.toString(),
    //     totalBorrowAssets: market.totalBorrowAssets.toString(),
    //     totalBorrowShares: market.totalBorrowShares.toString(),
    //   },
    // });

    return {
      supplyShares: position.supplyShares.toString(),
      supplyAssets: supplyAssets.toString(),
      borrowShares: position.borrowShares.toString(),
      borrowAssets: borrowAssets.toString(),
      collateral: position.collateral.toString(),
    };
  } catch (error) {
    console.error(`Error reading position:`, {
      marketId,
      userAddress,
      blockNumber,
      error,
    });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const blockNumber = parseInt(searchParams.get('blockNumber') ?? '0');
    const marketId = searchParams.get('marketId');
    const userAddress = searchParams.get('userAddress');
    const chainId = parseInt(searchParams.get('chainId') ?? '1');

    // console.log(`Historical position request:`, {
    //   blockNumber,
    //   marketId,
    //   userAddress,
    //   chainId,
    // });

    if (!blockNumber || !marketId || !userAddress) {
      console.error('Missing required parameters:', {
        blockNumber: !!blockNumber,
        marketId: !!marketId,
        userAddress: !!userAddress,
      });
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get position data at the specified blockNumber
    const position = await getPositionAtBlock(marketId, userAddress, blockNumber, chainId);

    // console.log(`Successfully retrieved historical position data:`, {
    //   blockNumber,
    //   marketId,
    //   userAddress,
    //   chainId,
    //   position,
    // });

    return NextResponse.json({
      position,
    });
  } catch (error) {
    console.error('Error in historical position API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
