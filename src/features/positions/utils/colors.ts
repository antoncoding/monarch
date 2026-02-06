// Consistent color for "Other" category across pie charts
export const OTHER_COLOR = '#64748B';

/**
 * Assign a color from the palette by index order.
 * Guarantees distinct colors within a single chart as long as item count < palette length.
 */
export function getColorByIndex(index: number, pieColors: readonly string[]): string {
  return pieColors[index % pieColors.length];
}
