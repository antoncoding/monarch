import { useMemo, useState } from 'react';
import { Checkbox } from '@nextui-org/react';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { Button } from '@/components/common/Button';
import { MarketInfoBlock } from '@/components/common/MarketInfoBlock';
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
import { useOnboarding } from './OnboardingContext';

export function RiskSelection() {
  const {
    selectedToken,
    selectedMarkets,
    setSelectedMarkets,
    canGoNext,
    goToNextStep,
    goToPrevStep,
  } = useOnboarding();
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
    const marketPath = `/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`;
    window.open(marketPath, '_blank');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Input Section */}
      <div>
        <p className="mt-2 font-zen text-gray-400">Choose collateral and oracle you trust</p>
        <p />
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

      {shouldShowMarkets && (
        <div>
          <p className="mt-4 text-gray-400">Choose markets</p>
          <p className="mt-2 text-sm text-gray-400"> selected markets: {selectedMarkets.length} </p>
        </div>
      )}

      {/* Markets List - Scrollable Section */}
      <div className="mt-6 flex-1">
        <div className="h-[calc(100vh-560px)] overflow-y-auto px-2 scrollbar-hide">
          {!shouldShowMarkets ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg">Select your preferences</p>
                <p className="mt-2 text-sm">
                  {selectedCollaterals.length === 0 && 'Choose at least one collateral asset'}
                  {selectedCollaterals.length > 0 &&
                    selectedOracles.length === 0 &&
                    'Now select oracle vendors'}
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
                    className="group flex items-center justify-between rounded-lg px-2 py-1 hover:bg-content2"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Checkbox
                        isSelected={isSelected}
                        onValueChange={(checked) => {
                          if (checked) {
                            setSelectedMarkets([...selectedMarkets, market]);
                          } else {
                            setSelectedMarkets(
                              selectedMarkets.filter((m) => m.uniqueKey !== market.uniqueKey),
                            );
                          }
                        }}
                      />
                      <div className="w-[280px]">
                        <MarketInfoBlock market={market} className="border-none bg-transparent" />
                      </div>

                      <div className="flex flex-1 items-center justify-end gap-4">
                        {/* Risk Indicators */}
                        <div className="flex w-[80px] justify-end gap-1">
                          <MarketAssetIndicator market={market} mode="complex" />
                          <MarketOracleIndicator market={market} mode="complex" />
                          <MarketDebtIndicator market={market} mode="complex" />
                        </div>

                        {/* Total Supply */}
                        <div className="w-[140px] text-right text-xs text-gray-500">
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

                        {/* Details Button */}
                        <Button
                          onClick={(e) => handleMarketDetails(market, e)}
                          variant="interactive"
                          className="w-[80px]"
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
        <Button variant="light" onPress={goToPrevStep} className="min-w-[120px]">
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
