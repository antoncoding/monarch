import { formatUnits } from 'viem';

const COMPACT_AMOUNT_LOCALE = 'en-US';
const COMPACT_AMOUNT_MIN_THRESHOLD = 0.000001;

export function formatFullTokenAmount(value: bigint, decimals: number): string {
  const formattedUnits = formatUnits(value, decimals);
  const [integerPart, fractionalPart = ''] = formattedUnits.split('.');
  const hasNegativeSign = integerPart.startsWith('-');
  const unsignedIntegerPart = hasNegativeSign ? integerPart.slice(1) : integerPart;
  const groupedIntegerPart = unsignedIntegerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFractionalPart = fractionalPart.replace(/0+$/, '');

  if (trimmedFractionalPart.length > 0) {
    return `${hasNegativeSign ? '-' : ''}${groupedIntegerPart}.${trimmedFractionalPart}`;
  }

  return `${hasNegativeSign ? '-' : ''}${groupedIntegerPart}`;
}

export function formatCompactTokenAmount(value: bigint, decimals: number): string {
  if (value === 0n) return '0';

  const numericValue = Number(formatUnits(value, decimals));
  if (!Number.isFinite(numericValue)) return formatUnits(value, decimals);

  const absoluteValue = Math.abs(numericValue);

  if (absoluteValue >= 1000) {
    return new Intl.NumberFormat(COMPACT_AMOUNT_LOCALE, {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(numericValue);
  }

  if (absoluteValue >= 1) {
    return numericValue.toLocaleString(COMPACT_AMOUNT_LOCALE, {
      maximumFractionDigits: 4,
    });
  }

  if (absoluteValue >= COMPACT_AMOUNT_MIN_THRESHOLD) {
    return numericValue.toLocaleString(COMPACT_AMOUNT_LOCALE, {
      maximumSignificantDigits: 4,
    });
  }

  return `<${COMPACT_AMOUNT_MIN_THRESHOLD}`;
}
