import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet, base } from 'viem/chains';

// Initialize Alchemy clients for each chain
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_MAINNET}`),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY_BASE}`),
});

/**
 * Handler for the /api/chain/blockNumber route, this route will return the current block number
 * @param req
 * @param res
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Get the Chain Id from the request
    const searchParams = req.nextUrl.searchParams;
    const chainId = parseInt(searchParams.get('chainId') || '1');
    
    console.log(`Getting current block number for chain ${chainId}`);
    
    const client = chainId === 1 ? mainnetClient : baseClient;
    const blockNumber = await client.getBlockNumber();
    
    console.log(`Current block number for chain ${chainId}: ${blockNumber}`);
    
    return NextResponse.json({ block: blockNumber.toString() }, { status: 200 });
  } catch (error) {
    console.error('Error fetching chains:', error);
    console.error(`Error getting block number for chain:`, error);
    return NextResponse.json({}, { status: 500, statusText: 'Internal Server Error' });
  }
}

export const dynamic = 'force-dynamic';
