import { MarketWarning } from './types';

const morphoOfficialWarnings = [
  {
    code: 'hardcoded_oracle',
    level: 'warning',
    description: 'This market uses a hardcoded oracle value',
    category: 'oracle',
  },
  {
    code: 'hardcoded_oracle_feed',
    level: 'warning',
    description: 'This market is using a hardcoded value in its oracle.	',
    category: 'oracle',
  },
  {
    code: 'unrecognized_oracle',
    level: 'alert',
    description: 'The oracle is not recognized',
    category: 'oracle',
  },
  {
    code: 'unrecognized_oracle_feed',
    level: 'alert',
    description: 'This market oracle has feed(s) that are not part of our recognized feeds list.',
    category: 'oracle',
  },
  {
    code: 'incorrect_loan_exchange_rate',
    level: 'warning',
    description: 'The market is using the exchange rate from a token different from the loan one.	',
    category: 'general',
  },
  {
    code: 'incorrect_collateral_exchange_rate',
    level: 'warning',
    description: 'The market is using the exchange rate from a token different from the collateral one.',
    category: 'general',
  },
  {
    code: 'unrecognized_collateral_asset',
    level: 'alert',
    description: 'The collateral asset is not recognized',
    category: 'asset',
  },
  {
    code: 'unrecognized_loan_asset',
    level: 'alert',
    description: 'The loan asset is not recognized',
    category: 'asset',
  },
  {
    code: 'bad_debt_unrealized',
    level: 'warning',
    description: 'This market has some unrealized bad debt',
    category: 'general',
  },
  {
    code: 'bad_debt_realized',
    level: 'warning',
    description: 'This market has some realized bad debt (>10 BPS of total supply)',
    category: 'general',
  },
  {
    code: 'not_whitelisted',
    level: 'alert',
    description: 'This market is not whitelisted by Morpho team',
    category: 'general',
  },
  {
    code: 'low_liquidity',
    level: 'warning',
    description: 'This market has low liquidity, you may not be able to withdraw once supplied',
    category: 'general',
  },
  {
    code: 'unsafe_vault_as_collateral_asset',
    level: 'alert',
    description: 'Market is using a MetaMorpho vault as collateral asset which has at least one minor (yellow) warning',
    category: 'general',
  },
  {
    code: 'incompatible_oracle_feeds',
    level: 'alert',
    description: 'The market is using oracle feeds which do not match with each other.',
    category: 'oracle',
  }
];

export const filterWarningTypes = (category: string, warnings: MarketWarning[]) => {
  const result = [];
  for (const warning of warnings) {
    const foundWarning = morphoOfficialWarnings.find((w) => w.code === warning.type);
    if (foundWarning && foundWarning.category === category) {
      result.push(foundWarning);
    }
  }
  return result;
};
