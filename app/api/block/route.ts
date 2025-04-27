import { NextRequest, NextResponse } from 'next/server';
import { PublicClient } from 'viem';
import { SmartBlockFinder } from '@/utils/blockFinder';
import { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

async function getBlockFromEtherscan(timestamp: number, chainId: number): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.etherscan.io/v2/api?chainid=${chainId}&module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=${ETHERSCAN_API_KEY}`,
    );

    const data = (await response.json()) as { status: string; message: string; result: string };

    if (data.status === '1' && data.message === 'OK') {
      return parseInt(data.result);
    }

    return null;
  } catch (error) {
    console.error('Etherscan API error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timestamp = searchParams.get('timestamp');
    const chainId = searchParams.get('chainId');

    if (!timestamp || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters: timestamp and chainId' },
        { status: 400 },
      );
    }

    const numericChainId = parseInt(chainId);
    const numericTimestamp = parseInt(timestamp);

    // Fallback to SmartBlockFinder
    const client = getClient(numericChainId as SupportedNetworks);

    // Try Etherscan API first
    const etherscanBlock = await getBlockFromEtherscan(numericTimestamp, numericChainId);
    if (etherscanBlock !== null) {
      // For Etherscan results, we need to fetch the block to get its timestamp
      const block = await client.getBlock({ blockNumber: BigInt(etherscanBlock) });

      return NextResponse.json({
        blockNumber: Number(block.number),
        timestamp: Number(block.timestamp),
      });
    } else {
      console.log('etherscanBlock is null', timestamp, chainId);
    }

    if (!client) {
      return NextResponse.json({ error: 'Unsupported chain ID' }, { status: 400 });
    }

    const finder = new SmartBlockFinder(client as any as PublicClient, numericChainId);
    const block = await finder.findNearestBlock(numericTimestamp);

    return NextResponse.json({
      blockNumber: Number(block.number),
      timestamp: Number(block.timestamp),
    });
  } catch (error) {
    console.error('Error finding block:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 },
    );
  }
}
