import { NextRequest, NextResponse } from 'next/server';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ALCHEMY_URLS = {
  '1': `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  '8453': `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  '137': `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  '130': `https://unichain-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
};

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
    const alchemyUrl = ALCHEMY_URLS[chainId as keyof typeof ALCHEMY_URLS];
    if (!alchemyUrl) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    // Get token balances
    const balancesResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [address],
      }),
    });

    if (!balancesResponse.ok) {
      throw new Error(`HTTP error! status: ${balancesResponse.status}`);
    }

    const balancesData = (await balancesResponse.json()) as {
      id: number;
      jsonrpc: string;
      result: {
        tokenBalances: TokenBalance[];
      };
    };

    const nonZeroBalances: TokenBalance[] = balancesData.result.tokenBalances.filter(
      (token: TokenBalance) =>
        token.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    );

    // Filter out failed metadata requests
    const tokens = nonZeroBalances
      .filter((token) => token !== null)
      .map((token) => ({
        address: token.contractAddress.toLowerCase(),
        balance: BigInt(token.tokenBalance).toString(10),
      }));

    return NextResponse.json({
      tokens,
    });
  } catch (error) {
    console.error('Failed to fetch balances:', error);
    return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 });
  }
}
