import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { MarketsTableWithSameLoanAsset } from '@/features/markets/components/markets-table-same-loan';
import type { MarketWithSelection } from '@/features/markets/components/markets-table-same-loan';
import { useTokens } from '@/components/providers/TokenProvider';
import { useOnboarding } from './onboarding-context';

export function MarketSelectionOnboarding() {
  const { selectedToken, selectedMarkets, setSelectedMarkets, canGoNext, goToNextStep, goToPrevStep } = useOnboarding();

  const { getUniqueTokens } = useTokens();

  // Get unique collateral tokens for filter performance
  const collateralTokens = useMemo(() => {
    if (!selectedToken?.markets) return [];
    const tokens = selectedToken.markets
      .filter((market) => market?.collateralAsset?.address && market?.morphoBlue?.chain?.id)
      .map((market) => ({
        address: market.collateralAsset.address,
        chainId: market.morphoBlue.chain.id,
      }));
    return getUniqueTokens(tokens);
  }, [selectedToken?.markets, getUniqueTokens]);

  // Convert markets to the format expected by the table
  const marketsWithSelection: MarketWithSelection[] = useMemo(() => {
    if (!selectedToken?.markets) return [];
    return selectedToken.markets
      .filter((market) => market && market.uniqueKey)
      .map((market) => ({
        market,
        isSelected: selectedMarkets.some((m) => m?.uniqueKey === market.uniqueKey),
      }));
  }, [selectedToken?.markets, selectedMarkets]);

  // Handle case when no token is selected yet
  if (!selectedToken) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-gray-400">No token selected. Please go back and select a token.</p>
        <Button
          variant="ghost"
          onClick={goToPrevStep}
          className="mt-4 min-w-[120px]"
        >
          Back
        </Button>
      </div>
    );
  }

  const handleToggleMarket = (marketId: string) => {
    if (!selectedToken.markets) return;
    const market = selectedToken.markets.find((m) => m?.uniqueKey === marketId);
    if (!market) return;

    if (selectedMarkets.some((m) => m?.uniqueKey === marketId)) {
      setSelectedMarkets(selectedMarkets.filter((m) => m?.uniqueKey !== marketId));
    } else {
      setSelectedMarkets([...selectedMarkets, market]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Description Section */}
      <div>
        <p className="mt-2 font-zen text-gray-400">
          Filter markets by your risk preferences and select the ones you want to use for your position.
        </p>
      </div>

      {/* Markets Table Section */}
      <div className="mt-6 flex-1">
        <MarketsTableWithSameLoanAsset
          markets={marketsWithSelection}
          onToggleMarket={handleToggleMarket}
          disabled={false}
          uniqueCollateralTokens={collateralTokens}
          showSelectColumn
          showCart={false}
        />
      </div>

      {/* Navigation - ALWAYS VISIBLE */}
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <Button
          variant="ghost"
          onClick={goToPrevStep}
          className="min-w-[120px]"
        >
          Back
        </Button>
        <Button
          variant="primary"
          onClick={goToNextStep}
          disabled={!canGoNext}
          className="min-w-[120px]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
