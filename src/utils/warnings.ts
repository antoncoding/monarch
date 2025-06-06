import { MarketWarning } from '@/utils/types';
import { monarchWhitelistedMarkets } from './markets';
import { WarningCategory, WarningWithDetail } from './types';

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
  {
    code: 'unrecognized_oracle',
    level: 'alert',
    description: 'The oracle is not recognized',
    category: WarningCategory.oracle,
  },
  {
    code: 'unrecognized_oracle_feed',
    level: 'alert',
    description: 'This market oracle has feed(s) that are not part of our recognized feeds list.',
    category: WarningCategory.oracle,
  },
  {
    code: 'incorrect_loan_exchange_rate',
    level: 'warning',
    description: 'The market is using the exchange rate from a token different from the loan one.	',
    category: WarningCategory.oracle,
  },
  {
    code: 'incorrect_collateral_exchange_rate',
    level: 'warning',
    description:
      'The market is using the exchange rate from a token different from the collateral one.',
    category: WarningCategory.oracle,
  },
  {
    code: 'incompatible_oracle_feeds',
    level: 'alert',
    description: 'The market is using oracle feeds which do not match with each other.',
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
    code: 'bad_debt_realized',
    level: 'warning',
    description: 'This market has some realized bad debt (>10 BPS of total supply)',
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
    description:
      'Market is using a MetaMorpho vault as collateral asset which has at least one minor warning',
    category: WarningCategory.asset,
  },
];

const subgraphWarnings: WarningWithDetail[] = [
  {
    code: 'subgraph_unrecognized_oracle',
    level: 'alert',
    description:
      'The underlying data source (subgraph) does not provide any details on this oralce address.',
    category: WarningCategory.oracle,
  },
  {
    code: 'subgraph_no_price',
    level: 'warning',
    description: 'The USD value of the market is estimated with an offchain price source.',
    category: WarningCategory.general,
  },
];

export const getMarketWarningsWithDetail = (
  market: { warnings: MarketWarning[]; uniqueKey: string },
  considerWhitelist = false,
) => {
  const result = [];

  const allDetails = [...morphoOfficialWarnings, ...subgraphWarnings];

  const whitelistedMarketData = considerWhitelist
    ? monarchWhitelistedMarkets.find((m) => m.id === market.uniqueKey.toLowerCase())
    : undefined;

  if (market.uniqueKey.startsWith('0x34f676')) {
    console.log('market', market);
  }

  if (whitelistedMarketData) {
    console.log('market', market);
  }

  // process official warnings
  for (const warning of market.warnings) {
    const foundWarning = allDetails.find((w) => w.code === warning.type);

    if (whitelistedMarketData) {
      console.log('whitelistedMarketData', whitelistedMarketData);
    }

    // if this market is whitelisted, there might be warnings we want to "offset"
    const isOffset = whitelistedMarketData?.offsetWarnings.includes(warning.type);

    if (foundWarning && !isOffset) {
      result.push(foundWarning);
    }
  }
  return result;
};
