export function formatOptionalTimestamp(seconds: bigint | number | null | undefined): string {
  if (seconds == null) return 'Unavailable';
  const numericSeconds = Number(seconds);
  if (!Number.isFinite(numericSeconds) || numericSeconds <= 0) return 'Unavailable';
  return new Date(numericSeconds * 1000).toLocaleString();
}

export function formatScannerTimestamp(value: string | null | undefined): string {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString();
}

export function formatFeedPriceNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  const absoluteValue = Math.abs(value);
  const maximumFractionDigits = absoluteValue >= 1000 ? 2 : absoluteValue >= 1 ? 6 : 10;
  return value.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

export function formatFeedPriceAxis(value: number): string {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 100_000) return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  if (absoluteValue >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return value.toLocaleString('en-US', { maximumSignificantDigits: 3 });
}
