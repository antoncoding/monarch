type AllocationPieChartProps = {
  percentage: number;
  size?: number;
};

export function AllocationPieChart({ percentage, size = 16 }: AllocationPieChartProps) {
  const isEmpty = percentage === 0;
  const radius = size / 2;
  const strokeWidth = 2;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <svg
      height={size}
      width={size}
      className="inline-block"
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Background circle - always same opacity */}
      <circle
        stroke="currentColor"
        fill="transparent"
        strokeWidth={strokeWidth}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="opacity-10"
      />
      {/* Progress circle - only shown when not empty */}
      {!isEmpty && (
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="opacity-70"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
