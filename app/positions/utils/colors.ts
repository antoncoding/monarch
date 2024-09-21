
// Helper function to get a color for each collateral
export function getCollateralColor(index: number, total: number): string {
  // Start with blue (240 degrees) and rotate around the color wheel
  const hue = (240 + (index * 360) / (total + 1)) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
