import { useMemo } from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { useMarkets } from '@/hooks/useMarkets';
import { useUserBalances } from '@/hooks/useUserBalances';
import { getNetworkImg, getNetworkName, SupportedNetworks } from '@/utils/networks';
import { useOnboarding } from './OnboardingContext';
import { TokenWithMarkets } from './types';

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
  const { balances, loading: balancesLoading } = useUserBalances();
  const { markets, loading: marketsLoading } = useMarkets();
  const { setSelectedToken, setSelectedMarkets, goToNextStep } = useOnboarding();

  const tokensWithMarkets = useMemo(() => {
    if (!balances || !markets) return [];

    const result: TokenWithMarkets[] = [];

    balances.forEach((balance) => {
      // Filter markets for this specific token and network
      const relevantMarkets = markets.filter(
        (market) =>
          market.morphoBlue.chain.id === balance.chainId &&
          market.loanAsset.address.toLowerCase() === balance.address.toLowerCase(),
      );

      if (relevantMarkets.length === 0) return;

      // Calculate min and max APY
      const apys = relevantMarkets.map((market) => market.state.supplyApy);
      const minApy = Math.min(...apys);
      const maxApy = Math.max(...apys);

      // Get network name
      const network = balance.chainId;

      result.push({
        symbol: balance.symbol,
        markets: relevantMarkets,
        minApy,
        maxApy,
        logoURI: balance.logoURI,
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
      <div className="flex-col">
        <div className="flex min-h-[400px] items-center justify-center">
          {' '}
          <Spinner />{' '}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {tokensWithMarkets.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded border border-gray-200 p-8 text-center dark:border-gray-700">
          <p className="text-lg">No assets available</p>
          <p className="text-sm text-gray-400">
            You need to have some assets in your wallet to supply
          </p>
          <Link href="/markets">
            <Button color="primary" className="rounded">
              View Markets
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {tokensWithMarkets.map((token) => (
            <motion.button
              aria-label={`Select ${token.symbol} on ${getNetworkName(token.network)}`}
              role="button"
              key={`${token.symbol}-${token.network}`}
              onClick={() => handleTokenSelect(token)}
              className="group relative flex items-start gap-4 rounded border border-gray-200 bg-white p-4 text-left transition-all duration-300 hover:border-primary hover:shadow-lg dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800"
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-transform duration-300 group-hover:scale-110 dark:bg-gray-700">
                {token.logoURI && (
                  <Image
                    src={token.logoURI}
                    alt={token.symbol}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-medium transition-colors duration-300 group-hover:text-primary">
                      {token.symbol}
                    </p>
                    <div className="badge">
                      <NetworkIcon networkId={token.network} />
                      <span>{getNetworkName(token.network)}</span>
                    </div>

                    {/* if base network, show agent badge */}
                    {token.network === SupportedNetworks.Base && (
                      <Tooltip
                        content={
                          <div className="flex flex-col gap-2 p-2 font-zen">
                            <div className="text-base">Monarch Autopilot 🎉</div>
                            <div className="text-sm">
                              Monarch Autopilot is now in beta on Base! Auto-reallocation enabled
                              for positions created with this token.
                            </div>
                          </div>
                        }
                      >
                        <div className="flex gap-2 rounded bg-primary bg-opacity-50 px-1.5 py-0.5 text-xs text-gray-100">
                          🤖
                          <span className="opacity-100">beta</span>
                        </div>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-400 transition-opacity duration-300 group-hover:opacity-80">
                    Balance: {formatUnits(BigInt(token.balance), token.decimals)} {token.symbol}
                  </p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium ">
                        {token.markets.length} market{token.markets.length !== 1 ? 's' : ''}
                      </p>
                      <span className="text-xs text-gray-400">•</span>
                      <p className="text-sm text-gray-400">
                        {(token.minApy * 100).toFixed(2)}% - {(token.maxApy * 100).toFixed(2)}% APY
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
