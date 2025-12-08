// Helper function to hash a string into a number
function hashStringToNumber(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    const char = label.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Helper function to get a color for each collateral based on its label
export function getCollateralColor(label: string): string {
  const hash = hashStringToNumber(label);
  const hue = hash % 360; // Use the hash to generate a hue value between 0 and 360
  return `hsl(${hue}, 70%, 50%)`;
}
