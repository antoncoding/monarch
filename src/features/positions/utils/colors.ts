// Consistent color for "Other" category across pie charts
export const OTHER_COLOR = '#64748B';

function hashStringToNumber(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    const char = label.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash);
}

export function getCollateralColorFromPalette(label: string, pieColors: readonly string[]): string {
  return pieColors[hashStringToNumber(label) % pieColors.length];
}
