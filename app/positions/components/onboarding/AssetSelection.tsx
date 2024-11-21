import { useMemo } from 'react';
import Image from 'next/image';
import { useMarkets } from '@/hooks/useMarkets';
import { useUserBalances } from '@/hooks/useUserBalances';
import { formatBalance } from '@/utils/balance';
import { TokenWithMarkets } from './types';
import { useOnboarding } from './OnboardingContext';
import { useRouter } from 'next/navigation';
import { Button } from '@nextui-org/react';
import Link from 'next/link';

export function AssetSelection() {
  const { balances, loading: balancesLoading } = useUserBalances();
  const { markets, loading: marketsLoading } = useMarkets();
  const { setSelectedToken } = useOnboarding();
  const router = useRouter();

  const tokensWithMarkets = useMemo(() => {
    if (!balances || !markets) return [];

    const result: TokenWithMarkets[] = [];
    
    balances.forEach(balance => {
      // Filter markets for this specific token and network
      const relevantMarkets = markets.filter(market => 
        market.morphoBlue.chain.id === balance.chainId &&
        market.loanAsset.address.toLowerCase() === balance.address.toLowerCase()
      );

      if (relevantMarkets.length === 0) return;

      // Calculate min and max APY
      const apys = relevantMarkets.map(market => market.state.supplyApy);
      const minApy = Math.min(...apys);
      const maxApy = Math.max(...apys);

      // Get network name
      const network = balance.chainId === 1 ? 'Mainnet' : 'Base';

      result.push({
        symbol: balance.symbol,
        balance: balance.balance,
        chainId: balance.chainId,
        markets: relevantMarkets,
        minApy,
        maxApy,
        logoURI: balance.logoURI,
        decimals: balance.decimals,
        network
      });
    });

    return result.sort((a, b) => b.markets.length - a.markets.length);
  }, [balances, markets]);

  const handleTokenSelect = (token: TokenWithMarkets) => {
    setSelectedToken(token);
    router.push('/positions/onboarding?step=risk-selection');
  };

  if (balancesLoading || marketsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h2 className="font-zen text-2xl">Select Asset to Lend</h2>
        <p className="mt-2 text-gray-400">Choose which token you want to lend</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tokensWithMarkets.map((token) => (
          <button
            key={`${token.symbol}-${token.chainId}`}
            onClick={() => handleTokenSelect(token)}
            className="group flex flex-col gap-4 rounded-lg border border-gray-700/50 bg-surface p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:border-monarch-orange hover:bg-surface/80 hover:shadow-lg dark:border-gray-700/30"
          >
            <div className="flex items-center gap-3">
              {token.logoURI && (
                <div className="relative h-8 w-8 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-110">
                  <Image
                    src={token.logoURI}
                    alt={token.symbol}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-zen text-lg transition-colors duration-300 group-hover:text-monarch-orange">
                    {token.symbol}
                  </h3>
                  <span className="rounded-lg bg-gray-100/10 px-2 py-0.5 text-xs text-gray-400 transition-colors duration-300 group-hover:text-gray-300">
                    {token.network}
                  </span>
                </div>
                <p className="text-sm text-gray-400 transition-opacity duration-300 group-hover:opacity-80">
                  Balance: {formatBalance(BigInt(token.balance), token.decimals)}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm transition-colors duration-300 group-hover:text-monarch-orange">
                {token.markets.length} market{token.markets.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-gray-400 transition-opacity duration-300 group-hover:opacity-80">
                APY Range: {token.minApy.toFixed(2)}% - {token.maxApy.toFixed(2)}%
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
