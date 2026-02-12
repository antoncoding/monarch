import { getOracleFromMetadata, isMetaOracleData, type OracleMetadataRecord } from '@/hooks/useOracleMetadata';
import type { Market, MarketWarning } from '@/utils/types';
import { monarchWhitelistedMarkets, getMarketOverrideWarnings } from './markets';
import { getOracleType, OracleType, parsePriceFeedVendors, parseMetaOracleVendors, checkFeedsPath, checkEnrichedFeedsPath } from './oracle';
import { WarningCategory, type WarningWithDetail } from './types';

// Subgraph Warnings

// Default subrgaph  has no oracle data attached!
export const SUBGRAPH_NO_ORACLE = {
  type: 'subgraph_unrecognized_oracle',
  level: 'alert',
  __typename: 'OracleWarning_MonarchAttached',
};

// Most subgraph markets has no price data
export const SUBGRAPH_NO_PRICE = {
  type: 'subgraph_no_price',
  level: 'warning',
  __typename: 'MarketWarning_SubgraphNoPrice',
};

export const subgraphDefaultWarnings: MarketWarning[] = [SUBGRAPH_NO_ORACLE];

export const UNRECOGNIZED_LOAN = {
  type: 'unrecognized_loan_asset',
  level: 'alert',
  __typename: 'MarketWarning_UnrecognizedLoanAsset',
};

export const UNRECOGNIZED_COLLATERAL = {
  type: 'unrecognized_collateral_asset',
  level: 'alert',
  __typename: 'MarketWarning_UnrecognizedCollateralAsset',
};

// Morpho Official Warnings

const morphoOfficialWarnings: WarningWithDetail[] = [
  {
    code: 'hardcoded_oracle',
    level: 'warning',
    description: 'This market uses a hardcoded oracle value (or missing one or more feed routes)',
    category: WarningCategory.oracle,
  },
  {
    code: 'hardcoded_oracle_feed',
    level: 'warning',
    description: 'This market is using a hardcoded value in one or more of its feed routes',
    category: WarningCategory.oracle,
  },
  // asset types
  {
    code: 'unrecognized_collateral_asset',
    level: 'alert',
    description: 'The collateral asset is not recognized',
    category: WarningCategory.asset,
  },
  {
    code: 'unrecognized_loan_asset',
    level: 'alert',
    description: 'The loan asset is not recognized',
    category: WarningCategory.asset,
  },
  // debt types: might have losses
  {
    code: 'bad_debt_unrealized',
    level: 'warning',
    description: 'This market has some unrealized bad debt',
    category: WarningCategory.debt,
  },

  {
    code: 'not_whitelisted',
    level: 'alert',
    description: 'This market is not whitelisted by Morpho team',
    category: WarningCategory.general,
  },
  {
    code: 'low_liquidity',
    level: 'warning',
    description: 'This market has low liquidity.',
    category: WarningCategory.general,
  },
  {
    code: 'unsafe_vault_as_collateral_asset',
    level: 'alert',
    description: 'Market is using a MetaMorpho vault as collateral asset which has at least one minor warning',
    category: WarningCategory.asset,
  },
];

const subgraphWarnings: WarningWithDetail[] = [
  {
    code: 'subgraph_no_price',
    level: 'warning',
    description: 'The USD value of the market is estimated with an offchain price source.',
    category: WarningCategory.general,
  },
];

const BAD_DEBT: WarningWithDetail = {
  code: 'bad_debt_realized',
  level: 'warning',
  description: 'This market has some realized bad debt (>10 BPS of total supply)',
  category: WarningCategory.debt,
};

const UNRECOGNIZED_ORACLE: WarningWithDetail = {
  code: 'unrecognized_oracle',
  level: 'alert',
  description: 'This market is using a custom oracle contract that is not recognized.',
  category: WarningCategory.oracle,
};

const INCOMPATIBLE_ORACLE_FEEDS: WarningWithDetail = {
  code: 'incompatible_oracle_feeds',
  level: 'warning',
  description: 'The oracle feeds cannot produce a valid price path for this market.',
  category: WarningCategory.oracle,
};

const UNKNOWN_FEED_FOR_PAIR_MATCHING: WarningWithDetail = {
  code: 'unknown_oracle_feeds',
  level: 'warning',
  description: 'The oracle contains feeds with unknown asset pairs.',
  category: WarningCategory.oracle,
};

// not on any list: Danger (alert level)
const UNRECOGNIZED_FEEDS: WarningWithDetail = {
  code: 'unknown feeds',
  level: 'alert',
  description: 'This market oracle has feed(s) that are not part of any recognized feeds list.',
  category: WarningCategory.oracle,
};

// morpho config list
const UNRECOGNIZED_FEEDS_TAGGED: WarningWithDetail = {
  code: 'unknown feeds tagged',
  level: 'warning',
  description: 'This market oracle has feeds that were tagged by Morpho but not verified by Monarch',
  category: WarningCategory.oracle,
};

type MarketWarningsOptions = {
  considerWhitelist?: boolean;
  oracleMetadataMap?: OracleMetadataRecord;
};

export const getMarketWarningsWithDetail = (market: Market, optionsOrWhitelist?: boolean | MarketWarningsOptions) => {
  // Handle legacy boolean parameter for backward compatibility
  const options: MarketWarningsOptions =
    typeof optionsOrWhitelist === 'boolean' ? { considerWhitelist: optionsOrWhitelist } : (optionsOrWhitelist ?? {});
  const { considerWhitelist = false, oracleMetadataMap } = options;
  const result = [];

  const allDetails = [...morphoOfficialWarnings, ...subgraphWarnings];

  const whitelistedMarketData = considerWhitelist
    ? monarchWhitelistedMarkets.find((m) => m.id === market.uniqueKey.toLowerCase())
    : undefined;

  // process official warnings
  for (const warning of market.warnings) {
    const foundWarning = allDetails.find((w) => w.code === warning.type);

    // if this market is whitelisted, there might be warnings we want to "offset"
    const isOffset = whitelistedMarketData?.offsetWarnings.includes(warning.type);

    if (foundWarning && !isOffset) {
      result.push(foundWarning);
    }
  }

  // Append bad debt warnings
  try {
    const badDebtUnderlying = market.realizedBadDebt.underlying;
    if (badDebtUnderlying != null) {
      const badDebt = BigInt(badDebtUnderlying);
      if (badDebt > 0n) {
        // only push the bad debt error is it's > 10BPS
        const supplyAssets = BigInt(market.state.supplyAssets);
        if (badDebt * 1000n > supplyAssets) {
          result.push(BAD_DEBT);
        }
      }
    }
  } catch {
    // ignore invalid BigInt values (e.g., decimal strings like "0.00")
  }

  // Append our own oracle warnings
  const oracleType = getOracleType(market.oracle?.data, market.oracleAddress, market.morphoBlue.chain.id, oracleMetadataMap);
  if (oracleType === OracleType.Custom) result.push(UNRECOGNIZED_ORACLE);

  // if any of the feeds are not null but also not recognized, return appropriate feed warning
  if (oracleType === OracleType.Standard && market.oracle?.data) {
    const metadataOptions = oracleMetadataMap ? { metadataMap: oracleMetadataMap, oracleAddress: market.oracleAddress } : undefined;

    const vendorInfo = parsePriceFeedVendors(market.oracle.data, market.morphoBlue.chain.id, metadataOptions);

    // Completely unknown feeds get the stronger warning
    if (vendorInfo.hasCompletelyUnknown) {
      result.push(UNRECOGNIZED_FEEDS);
    }

    // Tagged but not core vendors get the milder warning
    if (vendorInfo.hasTaggedUnknown) {
      result.push(UNRECOGNIZED_FEEDS_TAGGED);
    }

    // Check if oracle feeds can produce a valid price path
    if (market.collateralAsset?.symbol && market.loanAsset?.symbol) {
      const feedsPathResult = checkFeedsPath(
        market.oracle.data,
        market.morphoBlue.chain.id,
        market.collateralAsset.symbol,
        market.loanAsset.symbol,
        metadataOptions,
      );

      if (feedsPathResult.hasUnknownFeed) {
        // only append this error if it doesn't already have "UNRECOGNIZED_FEEDS"
        if (!result.includes(UNRECOGNIZED_FEEDS)) {
          result.push(UNKNOWN_FEED_FOR_PAIR_MATCHING);
        }
      } else if (!feedsPathResult.isValid) {
        result.push({
          ...INCOMPATIBLE_ORACLE_FEEDS,
          description: feedsPathResult.missingPath ?? INCOMPATIBLE_ORACLE_FEEDS.description,
        });
      }
    }
  }

  // Meta oracles: run vendor + feed path checks on both primary and backup oracle feeds
  if (oracleType === OracleType.Meta && oracleMetadataMap) {
    const metadata = getOracleFromMetadata(oracleMetadataMap, market.oracleAddress);
    if (metadata?.data && isMetaOracleData(metadata.data)) {
      const vendorInfo = parseMetaOracleVendors(metadata.data);
      if (vendorInfo.hasCompletelyUnknown) result.push(UNRECOGNIZED_FEEDS);
      if (vendorInfo.hasTaggedUnknown) result.push(UNRECOGNIZED_FEEDS_TAGGED);

      if (market.collateralAsset?.symbol && market.loanAsset?.symbol) {
        const primaryResult = metadata.data.oracleSources.primary
          ? checkEnrichedFeedsPath(metadata.data.oracleSources.primary, market.collateralAsset.symbol, market.loanAsset.symbol)
          : { isValid: false, hasUnknownFeed: true };
        const backupResult = metadata.data.oracleSources.backup
          ? checkEnrichedFeedsPath(metadata.data.oracleSources.backup, market.collateralAsset.symbol, market.loanAsset.symbol)
          : { isValid: false, hasUnknownFeed: true };

        const hasUnknown = primaryResult.hasUnknownFeed || backupResult.hasUnknownFeed;
        const eitherValid = primaryResult.isValid || backupResult.isValid;

        if (hasUnknown) {
          if (!result.includes(UNRECOGNIZED_FEEDS)) {
            result.push(UNKNOWN_FEED_FOR_PAIR_MATCHING);
          }
        } else if (!eitherValid) {
          result.push({
            ...INCOMPATIBLE_ORACLE_FEEDS,
            description:
              'Neither the primary nor backup oracle produces a valid price path for this pair. ' +
              'Price divergence may not be reflected even after oracle switching.',
          });
        }
      }
    }
  }

  // Inject custom market warnings from override rules
  const overrideWarnings = getMarketOverrideWarnings(market.uniqueKey);
  for (const warning of overrideWarnings) {
    result.push({ ...warning, category: warning.category as WarningCategory });
  }

  return result;
};

// Risk level type for UI components
export type RiskLevel = 'green' | 'yellow' | 'red';

/**
 * Determine risk level for a set of warnings
 * - green: no warnings
 * - yellow: has warnings but no alerts
 * - red: has at least one alert-level warning
 */
export const getRiskLevel = (warnings: WarningWithDetail[]): RiskLevel => {
  if (warnings.length === 0) return 'green';
  if (warnings.some((w) => w.level === 'alert')) return 'red';
  return 'yellow';
};

/**
 * Count warnings by level
 */
export const countWarningsByLevel = (warnings: WarningWithDetail[]) => {
  const alertCount = warnings.filter((w) => w.level === 'alert').length;
  const warningCount = warnings.filter((w) => w.level === 'warning').length;
  return { alertCount, warningCount };
};
