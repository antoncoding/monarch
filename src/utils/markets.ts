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
];
