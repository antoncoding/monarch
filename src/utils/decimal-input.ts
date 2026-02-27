const DECIMAL_INPUT_REGEX = /^\d*\.?\d*$/;

export const sanitizeDecimalInput = (value: string): string => {
  // Normalize decimal separators only; do not strip unsupported characters.
  // This keeps invalid formats invalid instead of mutating them into another number.
  const normalized = value.trim().replace(/,/g, '.');
  const [wholePart, ...fractionParts] = normalized.split('.');
  if (fractionParts.length === 0) {
    return wholePart;
  }
  return `${wholePart}.${fractionParts.join('')}`;
};

export const isValidDecimalInput = (value: string): boolean => {
  return DECIMAL_INPUT_REGEX.test(value);
};

export const toParseableDecimalInput = (value: string): string | null => {
  if (value === '' || value === '.') {
    return null;
  }

  const withLeadingZero = value.startsWith('.') ? `0${value}` : value;
  const trimmedTrailingDot = withLeadingZero.endsWith('.') ? withLeadingZero.slice(0, -1) : withLeadingZero;
  return trimmedTrailingDot.length > 0 ? trimmedTrailingDot : null;
};
