import { NextRequest, NextResponse } from 'next/server';
import { PublicClient } from 'viem';
import { SmartBlockFinder } from '@/utils/blockFinder';
import { SupportedNetworks } from '@/utils/networks';
import { mainnetClient, baseClient } from '@/utils/rpc';

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
    const client = numericChainId === SupportedNetworks.Mainnet ? mainnetClient : baseClient;

    if (!client) {
      return NextResponse.json({ error: 'Unsupported chain ID' }, { status: 400 });
    }

    const finder = new SmartBlockFinder(client as any as PublicClient, numericChainId);

    console.log('GET functino trying to find nearest block', timestamp);
    const block = await finder.findNearestBlock(parseInt(timestamp));

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
