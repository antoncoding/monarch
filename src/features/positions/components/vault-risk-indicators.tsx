import { useMemo } from 'react';
import type { UserVaultV2 } from '@/data-sources/morpho-api/v2-vaults-full';
import { RiskIndicator } from '@/features/markets/components/risk-indicator';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { computeMarketWarnings } from '@/hooks/useMarketWarnings';
import { parseCapIdParams } from '@/utils/morpho';
import { type WarningWithDetail, WarningCategory } from '@/utils/types';

type AggregatedVaultRiskIndicatorsProps = {
  vault: UserVaultV2;
};

/**
 * Aggregates risk indicators from all markets allocated in a vault.
 * Similar to AggregatedRiskIndicators but works with vault data structure.
 */
export function AggregatedVaultRiskIndicators({ vault }: AggregatedVaultRiskIndicatorsProps) {
  const { allMarkets } = useProcessedMarkets();

  // Aggregate warnings from all markets in the vault
  const uniqueWarnings = useMemo((): WarningWithDetail[] => {
    const allWarnings: WarningWithDetail[] = [];

    vault.caps.forEach((cap) => {
      const params = parseCapIdParams(cap.idParams);

      // Only process market caps (not collateral caps)
      if (params.type === 'market' && params.marketId) {
        const market = allMarkets.find((m) => m.uniqueKey.toLowerCase() === params.marketId?.toLowerCase());

        if (market) {
          const marketWarnings = computeMarketWarnings(market, true);
          allWarnings.push(...marketWarnings);
        }
      }
    });

    // Remove duplicates based on warning code
    return allWarnings.filter((warning, index, array) => array.findIndex((w) => w.code === warning.code) === index);
  }, [vault.caps, allMarkets]);

  // Helper to get warnings by category and determine risk level
  const getWarningIndicator = (category: WarningCategory, greenDesc: string, yellowDesc: string, redDesc: string) => {
    const categoryWarnings = uniqueWarnings.filter((w) => w.category === category);

    if (categoryWarnings.length === 0) {
      return (
        <RiskIndicator
          level="green"
          description={greenDesc}
          mode="complex"
        />
      );
    }

    if (categoryWarnings.some((w) => w.level === 'alert')) {
      const alertWarning = categoryWarnings.find((w) => w.level === 'alert');
      return (
        <RiskIndicator
          level="red"
          description={`One or more markets have: ${redDesc}`}
          mode="complex"
          warningDetail={alertWarning}
        />
      );
    }

    return (
      <RiskIndicator
        level="yellow"
        description={`One or more markets have: ${yellowDesc}`}
        mode="complex"
        warningDetail={categoryWarnings[0]}
      />
    );
  };

  return (
    <>
      {getWarningIndicator(WarningCategory.asset, 'Recognized asset', 'Asset with warning', 'High-risk asset')}
      {getWarningIndicator(WarningCategory.oracle, 'Recognized oracles', 'Oracle warning', 'Oracle warning')}
      {getWarningIndicator(WarningCategory.debt, 'No bad debt', 'Bad debt has occurred', 'Bad debt higher than 1% of supply')}
    </>
  );
}
