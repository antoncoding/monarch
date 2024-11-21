import { useMemo, useState } from 'react';
import { Button } from '@nextui-org/react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatUnits } from 'viem';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { formatReadable } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { OracleVendors, parseOracleVendors } from '@/utils/oracle';
import { findToken, getUniqueTokens } from '@/utils/tokens';
import { Market } from '@/utils/types';
import AssetFilter from 'app/markets/components/AssetFilter';
import OracleFilter from 'app/markets/components/OracleFilter';
import {
  MarketDebtIndicator,
  MarketAssetIndicator,
  MarketOracleIndicator,
} from 'app/markets/components/RiskIndicator';
import { useOnboarding } from './OnboardingContext';

export function RiskSelection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedToken, setSelectedMarkets } = useOnboarding();
  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>([]);
  const [selectedOracles, setSelectedOracles] = useState<OracleVendors[]>([]);
  const [selectedMarkets, setSelectedMarketsLocal] = useState<Set<string>>(new Set());

  const collateralTokens = useMemo(() => {
    if (!selectedToken?.markets) return [];
    const tokens = selectedToken.markets.map((market) => ({
      address: market.collateralAsset.address,
      chainId: market.morphoBlue.chain.id,
    }));
    return getUniqueTokens(tokens);
  }, [selectedToken]);

  // Filter markets based on selected collaterals and oracles
  const filteredMarkets = useMemo(() => {
    if (!selectedToken?.markets) return [];

    return selectedToken.markets
      .filter((market) => {
        // Skip markets without known collateral
        const collateralToken = findToken(
          market.collateralAsset.address,
          market.morphoBlue.chain.id,
        );
        if (!collateralToken) return false;

        // Check if collateral is selected (if any are selected)
        if (selectedCollaterals.length > 0) {
          const tokenKey = `${market.collateralAsset.address.toLowerCase()}-${
            market.morphoBlue.chain.id
          }`;
          if (!selectedCollaterals.some((key) => key.split('|').includes(tokenKey))) return false;
        }

        // Check if oracle is selected (if any are selected)
        if (selectedOracles.length > 0) {
          const { vendors } = parseOracleVendors(market.oracle.data);
          // Check if all vendors are selected
          if (!vendors.every((vendor) => selectedOracles.includes(vendor))) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aAssets = Number(a.state.supplyAssets) || 0;
        const bAssets = Number(b.state.supplyAssets) || 0;
        return bAssets - aAssets;
      });
  }, [selectedToken, selectedCollaterals, selectedOracles]);

  const handleNext = () => {
    if (selectedMarkets.size > 0) {
      const selectedMarketsArray = Array.from(selectedMarkets)
        .map((key) => filteredMarkets.find((m) => m.uniqueKey === key))
        .filter((m): m is Market => m !== undefined);

      setSelectedMarkets(selectedMarketsArray);
      router.push('/positions/onboarding?step=setup');
    }
  };

  const handleMarketDetails = (market: Market, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentParams = searchParams.toString();
    const marketPath = `/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`;
    const targetPath = currentParams ? `${marketPath}?${currentParams}` : marketPath;
    router.push(targetPath);
  };

  const toggleMarketSelection = (market: Market) => {
    const newSelection = new Set(selectedMarkets);
    if (selectedMarkets.has(market.uniqueKey)) {
      newSelection.delete(market.uniqueKey);
    } else {
      newSelection.add(market.uniqueKey);
    }
    setSelectedMarketsLocal(newSelection);
  };

  return (
    <div className="flex h-full flex-col">
      <div>
        <h2 className="font-zen text-2xl">Select Your Risk Preference</h2>
        <p className="mt-2 text-gray-400">Choose which assets and oracles you want to trust</p>
      </div>

      {/* Input Section */}
      <div className="mt-6 flex gap-4 pb-6">
        <div className="flex-1">
          <AssetFilter
            label="Collateral Assets"
            placeholder="Select collateral assets"
            selectedAssets={selectedCollaterals}
            setSelectedAssets={setSelectedCollaterals}
            items={collateralTokens}
            loading={false}
          />
        </div>
        <div className="flex-1">
          <OracleFilter selectedOracles={selectedOracles} setSelectedOracles={setSelectedOracles} />
        </div>
      </div>

      <div>
        <p className="mt-2 text-gray-400">Choose markets you want to trust</p>
      </div>

      {/* Markets Table */}
      <div className="mt-6 min-h-0 flex-1">
        <div className="h-[calc(100vh-500px)] overflow-auto">
          <table className="responsive w-full rounded-md font-zen">
            <thead className="table-header sticky top-0 z-[1] bg-gray-50 text-sm dark:bg-gray-800">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 text-left font-normal">Market</th>
                <th className="whitespace-nowrap px-4 py-2 text-left font-normal">Market Params</th>
                <th className="whitespace-nowrap px-4 py-2 text-left font-normal">Oracle</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-normal">LLTV</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-normal">Supply APY</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-normal">Total Supply</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-normal">Utilization</th>
                <th className="whitespace-nowrap px-4 py-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body text-sm">
              {filteredMarkets.map((market) => {
                const collateralToken = findToken(
                  market.collateralAsset.address,
                  market.morphoBlue.chain.id,
                );
                if (!collateralToken) return null;

                const isSelected = selectedMarkets.has(market.uniqueKey);
                const { vendors } = parseOracleVendors(market.oracle.data);

                return (
                  <tr
                    key={market.uniqueKey}
                    onClick={() => toggleMarketSelection(market)}
                    className={`cursor-pointer transition-all duration-200 ease-in-out hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${
                      isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="flex items-center gap-2">
                        {collateralToken?.img && (
                          <div
                            className={`overflow-hidden rounded-full transition-all duration-200 ease-in-out ${
                              isSelected
                                ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900'
                                : ''
                            }`}
                          >
                            <Image
                              src={collateralToken.img}
                              alt={market.collateralAsset.symbol}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <a
                              href={getAssetURL(
                                market.collateralAsset.address,
                                market.morphoBlue.chain.id,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 no-underline hover:underline"
                            >
                              {market.collateralAsset.symbol}
                            </a>
                            <button
                              onClick={(e) => handleMarketDetails(market, e)}
                              className="text-xs text-gray-400 hover:text-gray-300"
                              type="button"
                            >
                              {market.uniqueKey.slice(2, 8)}
                            </button>
                          </div>
                          <span className="text-xs text-gray-400">as collateral</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="flex gap-2">
                        <MarketAssetIndicator market={market} />
                        <MarketOracleIndicator market={market} />
                        <MarketDebtIndicator market={market} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-left">
                      <div className="flex flex-wrap gap-1">
                        {vendors.map((vendor) => (
                          <OracleVendorBadge
                            key={vendor}
                            oracleData={market.oracle.data}
                            showText={false}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                      {formatUnits(BigInt(market.lltv), 16)}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                      {formatReadable(market.state.supplyApy * 100)}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                      {formatReadable(
                        Number(
                          formatUnits(BigInt(market.state.supplyAssets), market.loanAsset.decimals),
                        ),
                      )}{' '}
                      {market.loanAsset.symbol}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono">
                      {formatReadable(market.state.utilization * 100)}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="light"
                        radius="sm"
                        onClick={(e) => handleMarketDetails(market, e)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between pt-4">
        <Button
          variant="light"
          className="min-w-[120px] rounded"
          onClick={() => router.push('/positions/onboarding?step=asset-selection')}
        >
          Back
        </Button>
        <Button
          color="primary"
          className="min-w-[120px] rounded"
          onClick={handleNext}
          disabled={selectedMarkets.size === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
