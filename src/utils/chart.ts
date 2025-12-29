/**
 * Format Unix timestamp for chart x-axis labels.
 */
export function formatChartTime(unixTime: number, timeRangeDuration: number): string {
  const date = new Date(unixTime * 1000);
  const ONE_DAY = 24 * 60 * 60; // 86400 seconds

  // For 1-day timeframe, show hours:minutes
  if (timeRangeDuration <= ONE_DAY) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // For longer timeframes, show month + day
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
