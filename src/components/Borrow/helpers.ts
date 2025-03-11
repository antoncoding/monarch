
export const LTV_THRESHOLDS = {
  DANGER: {
    value: 0.9,
    colorClass: 'red-500',
  },
  WARNING: {
    value: 0.75,
    colorClass: 'orange-400',
  },
  SAFE: {
    value: 0,
    colorClass: 'emerald-500',
  },
} as const;

type LTVStatus = {
  colorClass: string;
};


// Helper function to get color classes
export const getLTVColor = (ltv: bigint, lltv: bigint) => `text-${getLTVStatus(ltv, lltv).colorClass}`;

export const getLTVProgressColor = (ltv: bigint, lltv: bigint): string => {
  if (ltv === BigInt(0)) return 'bg-gray-500/80';
  const ratio = Number(ltv) / Number(lltv);
  
  if (ratio >= LTV_THRESHOLDS.DANGER.value) return 'bg-red-500/80';
  if (ratio >= LTV_THRESHOLDS.WARNING.value) return 'bg-orange-400/80';
  return 'bg-emerald-500/80';
};

// Get LTV status and colors
const getLTVStatus = (ltv: bigint, lltv: bigint): LTVStatus => {
  if (ltv === BigInt(0)) return { colorClass: 'gray-500' };
  const ratio = Number(ltv) / Number(lltv);

  if (ratio >= LTV_THRESHOLDS.DANGER.value) return LTV_THRESHOLDS.DANGER;
  if (ratio >= LTV_THRESHOLDS.WARNING.value) return LTV_THRESHOLDS.WARNING;
  return LTV_THRESHOLDS.SAFE;
};