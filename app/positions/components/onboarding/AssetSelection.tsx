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
  const { setSelectedToken, setSelectedMarkets } = useOnboarding();
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
        network,
        address: balance.address
      });
    });

    return result;
  }, [balances, markets]);

  const handleTokenSelect = (token: TokenWithMarkets) => {
    setSelectedToken(token);
    setSelectedMarkets([]); // Reset selected markets when changing token
    router.push('/positions/onboarding?step=risk-selection');
  };

  if (balancesLoading || marketsLoading) {
    return (
      <div className="flex h-full flex-col">
        <div>
          <h2 className="font-zen text-2xl">Select an Asset</h2>
          <p className="mt-2 text-gray-400">Choose which asset you want to supply</p>
        </div>
        <div className="mt-6">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div>
        <h2 className="font-zen text-2xl">Select an Asset</h2>
        <p className="mt-2 text-gray-400">Choose which asset you want to supply</p>
      </div>

      {tokensWithMarkets.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded-lg border border-gray-200 p-8 text-center dark:border-gray-700">
          <p className="text-lg">No assets available</p>
          <p className="text-sm text-gray-400">You need to have some assets in your wallet to supply</p>
          <Link href="/markets">
            <Button color="primary">View Markets</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tokensWithMarkets.map((token) => (
            <button
              key={`${token.symbol}-${token.chainId}`}
              onClick={() => handleTokenSelect(token)}
              className="group flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors duration-300 hover:border-monarch-orange dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                {token.logoURI && (
                  <Image src={token.logoURI} alt={token.symbol} width={32} height={32} />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col">
                  <p className="font-medium transition-colors duration-300 group-hover:text-monarch-orange">
                    {token.symbol}
                  </p>
                  <p className="text-sm text-gray-400 transition-opacity duration-300 group-hover:opacity-80">
                    {token.network}
                  </p>
                </div>
                <p className="text-sm text-gray-400 transition-opacity duration-300 group-hover:opacity-80">
                  Balance: {formatBalance(token.balance, token.decimals)} {token.symbol}
                </p>
                <div className="flex flex-col gap-2">
                  <p className="text-sm transition-colors duration-300 group-hover:text-monarch-orange">
                    {token.markets.length} market{token.markets.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-400 transition-opacity duration-300 group-hover:opacity-80">
                    APY Range: {(token.minApy * 100).toFixed(2)}% - {(token.maxApy * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
