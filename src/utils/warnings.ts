import { MarketWarning } from '@/utils/types';
import { WarningCategory, WarningWithDetail } from './types';

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

export const getMarketWarningsWithDetail = (market: { warnings: MarketWarning[] }) => {
  const result = [];

  // process official warnings
  for (const warning of market.warnings) {
    const foundWarning = morphoOfficialWarnings.find((w) => w.code === warning.type);
    if (foundWarning) {
      result.push(foundWarning);
    }
  }

  // ======================
  //   Add Extra warnings
  // ======================

  // bad debt warnings
  // if (market.badDebt && market.badDebt.usd > 0) {
  //   const warning = morphoOfficialWarnings.find((w) => w.code === 'bad_debt_unrealized');
  //   if (warning) {
  //     if (Number(market.badDebt.usd) > 0.01 * Number(market.state.supplyAssetsUsd)) {
  //       warning.level = 'alert';
  //     }
  //     result.push(warning);
  //   }
  // }
  // if (market.realizedBadDebt && market.realizedBadDebt.usd > 0) {
  //   const warning = morphoOfficialWarnings.find((w) => w.code === 'bad_debt_realized');
  //   if (warning) {
  //     if (Number(market.realizedBadDebt.usd) > 0.01 * Number(market.state.supplyAssetsUsd)) {
  //       warning.level = 'alert';
  //     }
  //     result.push(warning);
  //   }
  // }

  return result;
};
