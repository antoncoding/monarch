import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Address } from 'viem';
import { mainnet, base } from 'viem/chains';
import morphoABI from '@/abis/morpho';

// Initialize Alchemy clients for each chain
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
});

const BLOCK_TIME = {
  1: 12, // Ethereum mainnet: 12 seconds
  8453: 2, // Base: 2 seconds
} as const;

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

function arrayToPosition(arr: readonly bigint[]): Position {
  return {
    supplyShares: arr[0],
    borrowShares: arr[1],
    collateral: arr[2]
  };
}

function arrayToMarket(arr: readonly bigint[]): Market {
  return {
    totalSupplyAssets: arr[0],
    totalSupplyShares: arr[1],
    totalBorrowAssets: arr[2],
    totalBorrowShares: arr[3],
    lastUpdate: arr[4],
    fee: arr[5]
  };
}

function convertSharesToAssets(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  if (totalShares === 0n) return 0n;
  return (shares * totalAssets) / totalShares;
}

async function getBlockNumberFromTimestamp(timestamp: number, chainId: number): Promise<number> {
  const client = chainId === 1 ? mainnetClient : baseClient;
  
  // Get current block and its timestamp
  const currentBlock = await client.getBlockNumber();
  const currentBlockData = await client.getBlock({ blockNumber: currentBlock });
  const currentTimestamp = Number(currentBlockData.timestamp);
  
  // Calculate blocks ago based on timestamp difference and block time
  const timestampDiff = currentTimestamp - timestamp;
  const blockTime = BLOCK_TIME[chainId as keyof typeof BLOCK_TIME] || 12;
  const blocksAgo = Math.floor(timestampDiff / blockTime);
  
  // Calculate target block number
  const targetBlockNumber = Number(currentBlock) - blocksAgo;
  
  console.log('Block number calculation:', {
    currentBlock: Number(currentBlock),
    currentTimestamp,
    targetTimestamp: timestamp,
    timestampDiff,
    blockTime,
    blocksAgo,
    targetBlockNumber
  });
  
  return Math.max(0, targetBlockNumber);
}

async function getPositionAtBlock(
  marketId: string,
  userAddress: string,
  timestamp: number,
  chainId: number
) {
  console.log(`Processing position request for timestamp ${timestamp}`, {
    marketId,
    userAddress,
    timestamp,
    chainId
  });

  // Convert timestamp to block number
  const blockNumber = await getBlockNumberFromTimestamp(timestamp, chainId);
  console.log(`Estimated block number: ${blockNumber} for timestamp ${timestamp}`);

  const client = chainId === 1 ? mainnetClient : baseClient;
  const morphoAddress = chainId === 1 
    ? '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' // mainnet
    : '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb'; // base (same address)

  try {
    // Get the actual block to get its precise timestamp
    const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
    console.log(`Retrieved block ${blockNumber}:`, {
      timestamp: Number(block.timestamp),
      hash: block.hash
    });

    // First get the position data
    const positionArray = await client.readContract({
      address: morphoAddress as Address,
      abi: morphoABI,
      functionName: 'position',
      args: [marketId as `0x${string}`, userAddress as Address],
      blockNumber: BigInt(blockNumber),
    }) as readonly bigint[];

    // Convert array to position object
    const position = arrayToPosition(positionArray);

    // If position has no shares, return zeros early
    if (position.supplyShares === 0n && position.borrowShares === 0n && position.collateral === 0n) {
      console.log('Position has no shares, returning zeros');
      return {
        supplyShares: '0',
        supplyAssets: '0',
        borrowShares: '0',
        borrowAssets: '0',
        collateral: '0',
        timestamp: Number(block.timestamp)
      };
    }

    // Only fetch market data if position has shares
    const marketArray = await client.readContract({
      address: morphoAddress as Address,
      abi: morphoABI,
      functionName: 'market',
      args: [marketId as `0x${string}`],
      blockNumber: BigInt(blockNumber),
    }) as readonly bigint[];

    // Convert array to market object
    const market = arrayToMarket(marketArray);

    // Convert shares to assets
    const supplyAssets = convertSharesToAssets(
      position.supplyShares,
      market.totalSupplyAssets,
      market.totalSupplyShares
    );

    const borrowAssets = convertSharesToAssets(
      position.borrowShares,
      market.totalBorrowAssets,
      market.totalBorrowShares
    );

    console.log(`Successfully retrieved position data:`, {
      marketId,
      userAddress,
      blockNumber,
      timestamp: Number(block.timestamp),
      supplyShares: position.supplyShares.toString(),
      supplyAssets: supplyAssets.toString(),
      borrowShares: position.borrowShares.toString(),
      borrowAssets: borrowAssets.toString(),
      collateral: position.collateral.toString(),
      market: {
        totalSupplyAssets: market.totalSupplyAssets.toString(),
        totalSupplyShares: market.totalSupplyShares.toString(),
        totalBorrowAssets: market.totalBorrowAssets.toString(),
        totalBorrowShares: market.totalBorrowShares.toString(),
      }
    });

    return {
      supplyShares: position.supplyShares.toString(),
      supplyAssets: supplyAssets.toString(),
      borrowShares: position.borrowShares.toString(),
      borrowAssets: borrowAssets.toString(),
      collateral: position.collateral.toString(),
      timestamp: Number(block.timestamp)
    };
  } catch (error) {
    console.error(`Error reading position:`, {
      marketId,
      userAddress,
      blockNumber,
      timestamp,
      error
    });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timestamp = parseInt(searchParams.get('timestamp') || '0');
    const marketId = searchParams.get('marketId');
    const userAddress = searchParams.get('userAddress');
    const chainId = parseInt(searchParams.get('chainId') || '1');

    console.log(`Historical position request:`, {
      timestamp,
      marketId,
      userAddress,
      chainId
    });

    if (!timestamp || !marketId || !userAddress) {
      console.error('Missing required parameters:', {
        timestamp: !!timestamp,
        marketId: !!marketId,
        userAddress: !!userAddress
      });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get position data at the specified timestamp
    const position = await getPositionAtBlock(
      marketId,
      userAddress,
      timestamp,
      chainId
    );

    console.log(`Successfully retrieved historical position data:`, {
      timestamp,
      marketId,
      userAddress,
      chainId,
      position
    });

    return NextResponse.json({
      timestamp,
      position,
    });

  } catch (error) {
    console.error('Error in historical position API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
