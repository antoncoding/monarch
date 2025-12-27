import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useUserBalancesAllNetworks } from '@/hooks/useUserBalances';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { useOnboarding } from './onboarding-context';
import type { TokenWithMarkets } from './types';

function NetworkIcon({ networkId }: { networkId: number }) {
  const url = getNetworkImg(networkId);
  return (
    <Image
      src={url as string}
      alt={`networkId-${networkId}`}
      width={16}
      height={16}
      className="rounded-full"
    />
  );
}

export function AssetSelection() {
  const { balances, loading: balancesLoading } = useUserBalancesAllNetworks();
  const { markets, loading: marketsLoading } = useProcessedMarkets();
  const { setSelectedToken, setSelectedMarkets, goToNextStep } = useOnboarding();

  const tokensWithMarkets = useMemo(() => {
    if (!balances || !markets) return [];

    const result: TokenWithMarkets[] = [];

    balances.forEach((balance) => {
      // Filter markets for this specific token and network
      const relevantMarkets = markets.filter(
        (market) =>
          market.morphoBlue.chain.id === balance.chainId && market.loanAsset.address.toLowerCase() === balance.address.toLowerCase(),
      );

      if (relevantMarkets.length === 0) return;

      // Get network name
      const network = balance.chainId;

      const token = findToken(balance.address, balance.chainId);
      if (!token) return;

      result.push({
        symbol: balance.symbol,
        markets: relevantMarkets,
        logoURI: token.img,
        decimals: balance.decimals,
        network,
        address: balance.address,
        balance: balance.balance,
      });
    });

    return result;
  }, [balances, markets]);

  const handleTokenSelect = (token: TokenWithMarkets) => {
    setSelectedToken(token);
    setSelectedMarkets([]); // Reset selected markets when changing token
    goToNextStep();
  };

  if (balancesLoading || marketsLoading) {
    return (
      <div className="flex items-center justify-center py-16 min-w-xl">
        <div className="text-center">
          <Spinner />
          <p className="mt-3 text-sm text-secondary">
            {balancesLoading && marketsLoading
              ? 'Loading token balances and markets...'
              : balancesLoading
                ? 'Fetching your token balances across networks'
                : 'Loading available markets...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-xl">
      {tokensWithMarkets.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">No Assets Found</h3>
          <p className="text-secondary max-w-sm mx-auto mb-4">You need to have some assets in your wallet to supply</p>
          <Link href="/markets">
            <Button variant="primary">View Markets</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {tokensWithMarkets.map((token, idx) => (
            <div
              key={`${token.symbol}-${token.network}-${idx}`}
              className="relative cursor-pointer rounded-sm border p-3 transition-colors duration-200 border-gray-200 dark:border-gray-700 hover:bg-hovered"
              onClick={() => handleTokenSelect(token)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTokenSelect(token);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TokenIcon
                    address={token.address}
                    chainId={token.network}
                    width={20}
                    height={20}
                  />
                  <span className="font-medium">
                    {formatReadable(formatUnits(BigInt(token.balance), token.decimals))} {token.symbol}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <NetworkIcon networkId={token.network} />
                  <span className="text-sm text-secondary">
                    {token.markets.length} market
                    {token.markets.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
