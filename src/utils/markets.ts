/**
 * Parse and normalize a numeric threshold value from user input.
 * - Empty string or "0" → 0 (no threshold)
 * - Invalid values → 0
 * - Valid positive numbers → parsed value
 */
export const parseNumericThreshold = (rawValue: string | undefined | null): number => {
  if (rawValue === undefined || rawValue === null || rawValue === '' || rawValue === '0') {
    return 0;
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(parsed, 0);
};

// Blacklisted markets by uniqueKey
export const blacklistedMarkets = [
  '0x8eaf7b29f02ba8d8c1d7aeb587403dcb16e2e943e4e2f5f94b0963c2386406c9', // PAXG / USDC market with wrong oracle
  '0x7e79c25831c97175922df132d09b02f93103a2306b1d71e57a7714ddd4c15d13', // Relend USDC / USDC: Should be considered unrecoverable
  '0x1dca6989b0d2b0a546530b3a739e91402eee2e1536a2d3ded4f5ce589a9cd1c2', //
  '0xfdb8221edcae73f73485d55c30e706906114bc2ff4634870c5c57e8fb83eae6a', // USDC / K on arbitrum
  '0x0f9563442d64ab3bd3bcb27058db0b0d4046a4c46f0acd811dacae9551d2b129', // sdeUSD / USDC market from Elixir affected by incident
];

// Market specially whitelisted by Monarch, lowercase

type WhitelistMarketData = {
  id: string;

  // warning code to offset
  offsetWarnings: string[];
};

export const monarchWhitelistedMarkets: WhitelistMarketData[] = [
  {
    id: '0x74918a8744b4a48d233e66d0f6a318ef847cc4da2910357897f94a33c3481280', // sPinto/USDC by Pinto
    offsetWarnings: ['unrecognized_collateral_asset'],
  },
  {
    id: '0x9bc98c2f20ac58287ef2c860eea53a2fdc27c17a7817ff1206c0b7840cc7cd79', // Morpho API stopped tracking PT markets
    offsetWarnings: ['unrecognized_collateral_asset'],
  },
];

// Market override rules - group multiple markets under the same rule
export type MarketOverrideWarning = {
  code: string;
  level: 'warning' | 'alert';
  description: string;
  category: 'asset' | 'oracle' | 'debt' | 'general';
};

export type MarketOverrideRule = {
  // Markets this rule applies to (uniqueKey, lowercase)
  marketIds: string[];

  // Force these markets to appear as unwhitelisted
  forceUnwhitelisted?: boolean;

  // Custom warnings to attach
  warnings?: MarketOverrideWarning[];
};

export const marketOverrideRules: MarketOverrideRule[] = [
  {
    marketIds: [
      '0xdb2cf3ad3ef91c9bb673bf35744e7141bc2950b27a75c8d11b0ead9f6742d927',
      '0xe0ede98b4425285a9c93d51f8ba27d9a09bc0033874e4a883d3f29d41f9f2e4a',
      '0x2b62c4153d81d5b5a233d1d2b7ef899d3fca4076d458e215ff3a00176b415b0d',
      '0x216bd19960f140177a4a3fb9cf258edcbadb1f5d54740fc944503bff4a00e65e',
      '0xf474c9a0cbd8f2b65d9480d94b56880ca13f10fc3b3c717d47bdf3ac9c4417b7',
    ],
    forceUnwhitelisted: true,
    warnings: [
      {
        code: 'deprecated',
        level: 'alert',
        description: 'The loan asset (rUSDC) of this market is deprecating.',
        category: 'general',
      },
    ],
  },
];

// Helper functions to query the override rules
export const isForceUnwhitelisted = (marketId: string): boolean => {
  const normalizedId = marketId.toLowerCase();
  return marketOverrideRules.some((rule) => rule.forceUnwhitelisted && rule.marketIds.includes(normalizedId));
};

export const getMarketOverrideWarnings = (marketId: string): MarketOverrideWarning[] => {
  const normalizedId = marketId.toLowerCase();
  return marketOverrideRules
    .filter((rule) => rule.marketIds.includes(normalizedId) && rule.warnings)
    .flatMap((rule) => rule.warnings ?? []);
};
