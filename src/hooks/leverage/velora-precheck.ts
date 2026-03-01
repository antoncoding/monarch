const SOURCE_TOKEN_LABEL_REGEX = /\b(src token|source token)\b/;
const SHARE_PRICE_SCALE_E27 = 10n ** 27n;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasWholeWord = (message: string, value: string): boolean => {
  if (!value) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(value)}\\b`);
  return pattern.test(message);
};

type VeloraBypassablePrecheckErrorParams = {
  error: unknown;
  sourceTokenAddress: string;
  sourceTokenSymbol: string;
};

export const isVeloraBypassablePrecheckError = ({
  error,
  sourceTokenAddress,
  sourceTokenSymbol,
}: VeloraBypassablePrecheckErrorParams): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const isAllowancePrecheckError = message.includes('allowance given to tokentransferproxy');
  if (isAllowancePrecheckError) return true;

  if (!message.includes('not enough')) return false;
  if (!message.includes('balance') && !message.includes('insufficient')) return false;

  const normalizedSourceAddress = sourceTokenAddress.toLowerCase();
  const normalizedSourceSymbol = sourceTokenSymbol.trim().toLowerCase();
  const referencesSourceToken =
    message.includes(normalizedSourceAddress) || SOURCE_TOKEN_LABEL_REGEX.test(message) || hasWholeWord(message, normalizedSourceSymbol);

  return referencesSourceToken;
};

export const computeMaxSharePriceE27 = (maxAssets: bigint, shares: bigint): bigint => {
  if (maxAssets <= 0n || shares <= 0n) return 0n;
  return (maxAssets * SHARE_PRICE_SCALE_E27 + shares - 1n) / shares;
};
