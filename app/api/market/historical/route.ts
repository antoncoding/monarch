import { NextRequest, NextResponse } from 'next/server';
import morphoABI from '@/abis/morpho';
import { getMorphoAddress } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

// Types
type Market = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

// Helper function to convert array to market object
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

async function getMarketSnapshot(marketId: string, chainId: number, blockNumber?: number) {
  const isNow = !blockNumber || blockNumber === 0;

  if (!isNow) {
    console.log(`Get market snapshot ${marketId.slice(0, 6)} at blockNumber ${blockNumber}`);
  } else {
    console.log(`Get market snapshot ${marketId.slice(0, 6)} at current block`);
  }

  const client = getClient(chainId as SupportedNetworks);
  if (!client) throw new Error(`Unsupported chain ID: ${chainId}`);

  try {
    // Get the market data
    const marketArray = (await client.readContract({
      address: getMorphoAddress(chainId as SupportedNetworks),
      abi: morphoABI,
      functionName: 'market',
      args: [marketId as `0x${string}`],
      blockNumber: isNow ? undefined : BigInt(blockNumber!),
    })) as readonly bigint[];

    // Convert array to market object
    const market = arrayToMarket(marketArray);

    const liquidityAssets = market.totalSupplyAssets - market.totalBorrowAssets;

    // Return only the first 4 fields as requested
    return {
      totalSupplyAssets: market.totalSupplyAssets.toString(),
      totalSupplyShares: market.totalSupplyShares.toString(),
      totalBorrowAssets: market.totalBorrowAssets.toString(),
      totalBorrowShares: market.totalBorrowShares.toString(),
      liquidityAssets: liquidityAssets.toString(),
    };
  } catch (error) {
    console.error(`Error reading market:`, {
      marketId,
      chainId,
      blockNumber,
      error,
    });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const marketId = searchParams.get('marketId');
    const chainId = parseInt(searchParams.get('chainId') ?? '1');
    const blockNumber = searchParams.get('blockNumber')
      ? parseInt(searchParams.get('blockNumber')!)
      : undefined;

    if (!marketId) {
      console.error('Missing required parameters:', {
        marketId: !!marketId,
      });
      return NextResponse.json({ error: 'Missing required parameter: marketId' }, { status: 400 });
    }

    // Get market snapshot at the specified block (or current block if not specified)
    const market = await getMarketSnapshot(marketId, chainId, blockNumber);

    return NextResponse.json({
      market,
    });
  } catch (error) {
    console.error('Error in market snapshot API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
