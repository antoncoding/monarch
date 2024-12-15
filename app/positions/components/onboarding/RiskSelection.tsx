import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { formatReadable } from '@/utils/balance';
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
import { MarketInfoBlock } from '@/components/common/MarketInfoBlock';
import { Button } from '@/components/common/Button';
import { useOnboarding } from './OnboardingContext';

export function RiskSelection() {
  const searchParams = useSearchParams();
  const { selectedToken, selectedMarkets, setSelectedMarkets, canGoNext, goToNextStep, goToPrevStep } = useOnboarding();
  const [selectedCollaterals, setSelectedCollaterals] = useState<string[]>([]);
  const [selectedOracles, setSelectedOracles] = useState<OracleVendors[]>([]);

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

  // Check if criteria is met to show markets
  const shouldShowMarkets = selectedCollaterals.length > 0 && selectedOracles.length > 0;

  const handleMarketDetails = (market: Market, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentParams = searchParams.toString();
    const marketPath = `/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`;
    const targetPath = currentParams ? `${marketPath}?${currentParams}` : marketPath;

    // open in tab
    window.open(targetPath, '_blank');
  };

  const toggleMarketSelection = (market: Market) => {
    const ids = selectedMarkets.map((m) => m.uniqueKey);
    
    if (ids.includes(market.uniqueKey)) {
      setSelectedMarkets(selectedMarkets.filter((m) => m.uniqueKey !== market.uniqueKey));
    } else {
      setSelectedMarkets([...selectedMarkets, market]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Input Section */}
      <div>
        <p className="mt-2 font-zen text-gray-400">Choose collateral you want to trust</p>
        <p></p>
      </div>

      <div className="mt-2 flex gap-4">
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
        <p className="mt-4 text-gray-400">Choose markets you want to trust</p>
        <p className="mt-2 text-sm text-gray-400">
          {shouldShowMarkets 
            ? `selected markets: ${selectedMarkets.length}`
            : 'Select collateral and oracles to view available markets'}
        </p>
      </div>

      {/* Markets List - Scrollable Section */}
      <div className="mt-6 flex-1">
        <div className="h-[calc(100vh-560px)] overflow-y-auto px-2 scrollbar-hide">
          {!shouldShowMarkets ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg">Select your preferences</p>
                <p className="mt-2 text-sm">
                  {selectedCollaterals.length === 0 && 'Choose at least one collateral asset'}
                  {selectedCollaterals.length > 0 && selectedOracles.length === 0 && 'Now select oracle vendors'}
                </p>
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="-mx-2 flex flex-col space-y-4"
            >
              {filteredMarkets.map((market, index) => {
                const collateralToken = findToken(
                  market.collateralAsset.address,
                  market.morphoBlue.chain.id,
                );
                if (!collateralToken) return null;

                const isSelected = selectedMarkets.some((m) => m.uniqueKey === market.uniqueKey);

                return (
                  <motion.div
                    key={market.uniqueKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    onClick={() => toggleMarketSelection(market)}
                    className={`rounded relative cursor-pointer transition-all duration-200 ease-in-out p-1 ${
                      index === 0 ? 'mt-2' : ''
                    } ${isSelected ? 'border-2 bg-hovered' : ''}`}
                  >
                    <div className="flex w-full items-center justify-between pr-2">
                      <div className="min-w-[300px] pr-4">
                        <MarketInfoBlock market={market} className={`border-none ${isSelected ? 'bg-hovered' : 'bg-surface'} `} />
                      </div>

                      <div className="flex flex-1 items-center justify-end gap-8">
                        {/* Risk Indicators */}
                        <div className="flex gap-2">
                          <MarketAssetIndicator market={market} />
                          <MarketOracleIndicator market={market} />
                          <MarketDebtIndicator market={market} />
                        </div>

                        {/* Total Supply */}
                        <div className="text-xs text-gray-500">
                          <span>Total Supply:</span>
                          <div className="font-mono">
                            {formatReadable(
                              Number(
                                formatUnits(
                                  BigInt(market.state.supplyAssets),
                                  market.loanAsset.decimals,
                                ),
                              ),
                            )}{' '}
                            {market.loanAsset.symbol}
                          </div>
                        </div>

                        {/* Utilization Rate */}
                        <div className="text-xs text-gray-500">
                          <span>Utilization:</span>
                          <div className="font-mono">
                            {formatReadable(market.state.utilization * 100)}%
                          </div>
                        </div>

                        {/* Details Button */}
                        <Button
                          onClick={(e) => handleMarketDetails(market, e)}
                          variant="interactive"
                          className="ml-4"
                          size="sm"
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          onPress={goToPrevStep}
          className="min-w-[120px]"
        >
          Back
        </Button>
        <Button
          variant="cta"
          onPress={goToNextStep}
          isDisabled={!canGoNext}
          className="min-w-[120px]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
