const DECIMAL_INPUT_REGEX = /^\d*\.?\d*$/;

export const sanitizeDecimalInput = (value: string): string => {
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '');
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
