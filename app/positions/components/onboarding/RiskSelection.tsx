import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { Button } from '@/components/common/Button';
import { useTokens } from '@/components/providers/TokenProvider';
import { formatBalance, formatReadable } from '@/utils/balance';
import { PriceFeedVendors, parsePriceFeedVendors } from '@/utils/oracle';
import { Market } from '@/utils/types';
import AssetFilter from 'app/markets/components/AssetFilter';
import OracleFilter from 'app/markets/components/OracleFilter';
import { APYCell } from 'app/markets/components/APYBreakdownTooltip';
import { TDAsset } from 'app/markets/components/MarketTableUtils';
import OracleVendorBadge from '@/components/OracleVendorBadge';
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
  const [selectedOracles, setSelectedOracles] = useState<PriceFeedVendors[]>([]);

  const { findToken, getUniqueTokens } = useTokens();

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
          const { vendors } = parsePriceFeedVendors(
            market.oracle?.data,
            market.morphoBlue.chain.id,
          );

          // if vendors is empty, push "unknown oracle" into list that needed to be selected
          if (vendors.length === 0) {
            vendors.push(PriceFeedVendors.Unknown);
          }

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
  const shouldShowMarkets = selectedCollaterals.length > 0;

  const handleMarketDetails = (market: Market) => {
    const marketPath = `/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`;
    window.open(marketPath, '_blank');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Description Section */}
      <div>
        <p className="mt-2 font-zen text-gray-400">
          Filter markets by your risk preferences and select the ones you want to use for your position.
        </p>
      </div>

      <div className="mt-4 flex gap-4">
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

      {/* Markets Table Section - FIXED HEIGHT */}
      <div className="mt-6 h-96 overflow-y-auto">
          {!shouldShowMarkets ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="mb-4 text-4xl">📊</div>
                <p className="text-lg font-medium mb-2">Select your risk preferences</p>
                <p className="text-sm max-w-md">
                  {selectedCollaterals.length === 0 && 'Choose at least one collateral asset to view available markets'}
                  {selectedCollaterals.length > 0 &&
                    selectedOracles.length === 0 &&
                    'Now select oracle vendors to filter markets'}
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <table className="responsive w-full rounded-md font-zen">
                <thead className="table-header">
                  <tr>
                    <th className="font-normal w-8"></th>
                    <th className="font-normal">Collateral</th>
                    <th className="font-normal">Oracle</th>
                    <th className="font-normal">LLTV</th>
                    <th className="font-normal">Total Supply</th>
                    <th className="font-normal">APY</th>
                    <th className="font-normal">Risk</th>
                    <th className="font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body text-sm">
                  {filteredMarkets.map((market, index) => {
                    const collateralToken = findToken(
                      market.collateralAsset.address,
                      market.morphoBlue.chain.id,
                    );
                    if (!collateralToken) return null;

                    const isSelected = selectedMarkets.some((m) => m.uniqueKey === market.uniqueKey);
                    const collatToShow = market.collateralAsset.symbol
                      .slice(0, 6)
                      .concat(market.collateralAsset.symbol.length > 6 ? '...' : '');

                    return (
                      <motion.tr
                        key={market.uniqueKey}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={`cursor-pointer transition-colors duration-200 ${
                          isSelected
                            ? 'bg-primary/5 border-l-2 border-primary'
                            : 'hover:bg-hovered'
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMarkets(
                              selectedMarkets.filter((m) => m.uniqueKey !== market.uniqueKey),
                            );
                          } else {
                            setSelectedMarkets([...selectedMarkets, market]);
                          }
                        }}
                      >
                        {/* Selection Indicator */}
                        <td className="z-50 w-8">
                          <div className="flex items-center justify-center">
                            {isSelected && (
                              <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Collateral Asset */}
                        <TDAsset
                          dataLabel="Collateral"
                          asset={market.collateralAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={collatToShow}
                        />

                        {/* Oracle */}
                        <td data-label="Oracle" className="z-50">
                          <div className="flex justify-center">
                            <OracleVendorBadge
                              oracleData={market.oracle?.data}
                              chainId={market.morphoBlue.chain.id}
                            />
                          </div>
                        </td>

                        {/* LLTV */}
                        <td data-label="LLTV" className="z-50">
                          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs font-medium">
                            {Number(market.lltv) / 1e16}%
                          </span>
                        </td>

                        {/* Total Supply */}
                        <td data-label="Total Supply" className="z-50">
                          <p className="z-50">${formatReadable(Number(market.state.supplyAssetsUsd))}</p>
                          <p className="z-50 opacity-70 text-xs">
                            {formatReadable(formatBalance(market.state.supplyAssets, market.loanAsset.decimals))} {market.loanAsset.symbol}
                          </p>
                        </td>

                        {/* APY */}
                        <td data-label="APY">
                          <APYCell market={market} />
                        </td>

                        {/* Risk Indicators */}
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <MarketAssetIndicator market={market} />
                            <MarketOracleIndicator market={market} />
                            <MarketDebtIndicator market={market} />
                          </div>
                        </td>

                        {/* Actions */}
                        <td data-label="Actions" className="z-50">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarketDetails(market);
                            }}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
                          >
                            <ExternalLinkIcon className="w-3 h-3" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
      </div>

      {/* Navigation - ALWAYS VISIBLE */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <Button variant="light" onPress={goToPrevStep} className="min-w-[120px]">
          Back
        </Button>
        <div className="flex items-center gap-4">
          {selectedMarkets.length > 0 && (
            <span className="text-sm text-gray-500">
              {selectedMarkets.length} market{selectedMarkets.length !== 1 ? 's' : ''} selected
            </span>
          )}
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
    </div>
  );
}
