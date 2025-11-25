import { NextRequest, NextResponse } from 'next/server';
import { SupportedNetworks, getDefaultRPC } from '@/utils/networks';
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
    const alchemyUrl = getDefaultRPC(chainIdNum);
    if (!alchemyUrl) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    // Get supported token addresses for this chain
    const tokenAddresses = supportedTokens
      .filter(token =>
        token.networks.some(network => network.chain.id === chainIdNum)
      )
      .flatMap(token =>
        token.networks
          .filter(network => network.chain.id === chainIdNum)
          .map(network => network.address)
      );

    // Special handling for hyper and monad: no alchemy support
    if (
      chainIdNum === SupportedNetworks.HyperEVM || 
      chainIdNum === SupportedNetworks.Monad
    ) {
      const tokens = await getKnownBalancesWithClient(address, tokenAddresses, SupportedNetworks.HyperEVM);
      return NextResponse.json({ tokens });
    }

    // Get token balances for specific tokens only
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
        params: [address, tokenAddresses],
      }),
    });

    if (!balancesResponse.ok) {
      console.error(`Failed to fetch balances: ${balancesResponse.status} ${balancesResponse.statusText}`);
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
