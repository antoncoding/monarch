import type { PropsWithChildren } from 'react';

type VaultSummaryMetricsProps = PropsWithChildren & {
  columns?: 3 | 4;
};

export function VaultSummaryMetrics({ children, columns = 4 }: VaultSummaryMetricsProps) {
  const gridClass = columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  return <div className={`grid grid-cols-1 gap-4 font-zen sm:grid-cols-2 ${gridClass}`}>{children}</div>;
}
