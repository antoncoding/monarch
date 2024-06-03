import { MarketWarning } from './types';

const morphoOfficialWarnings = [
  {
    code: 'hardcoded_oracle',
    level: 'warning',
    description: 'This market uses a hardcoded oracle value',
    category: 'oracle',
  },
  {
    code: 'bad_debt_realized',
    level: 'warning',
    description: 'Bad debt has been realized',
    category: 'general',
  },
  {
    code: 'incorrect_loan_exchange_rate',
    level: 'warning',
    description: 'The loan exchange rate is incorrect',
    category: 'general',
  },
  {
    code: 'incorrect_collateral_exchange_rate',
    level: 'warning',
    description: 'The collateral exchange rate is incorrect',
    category: 'general',
  },
  {
    code: 'unrecognized_collateral_asset',
    level: 'alert',
    description: 'The collateral asset is not recognized',
    category: 'general',
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
    description: 'The oracle feed is not recognized',
    category: 'oracle',
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
