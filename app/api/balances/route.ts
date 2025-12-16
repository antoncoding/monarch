import { type NextRequest, NextResponse } from 'next/server';
import { SupportedNetworks } from '@/utils/networks';
import { supportedTokens } from '@/utils/tokens';
import { getKnownBalancesWithClient } from './evm-client';

type TokenBalance = {
  contractAddress: string;
  tokenBalance: string;
};

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const address = searchParams.get('address');
  const chainId = searchParams.get('chainId');

  if (!address || !chainId) {
    return NextResponse.json({ error: 'Missing address or chainId' }, { status: 400 });
  }

  try {
    const chainIdNum = Number(chainId) as SupportedNetworks;
    

    // Get supported token addresses for this chain
    const tokenAddresses = supportedTokens
      .filter((token) => token.networks.some((network) => network.chain.id === chainIdNum))
      .flatMap((token) => token.networks.filter((network) => network.chain.id === chainIdNum).map((network) => network.address));

    // use multicall to query balances at onces
    const tokens = await getKnownBalancesWithClient(address, tokenAddresses, chainIdNum);
    return NextResponse.json({ tokens });

  } catch (error) {
    console.error('Failed to fetch balances:', error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }
}
