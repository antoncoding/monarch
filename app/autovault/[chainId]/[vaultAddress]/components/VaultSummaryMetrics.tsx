import { PropsWithChildren } from 'react';

export function VaultSummaryMetrics({ children }: PropsWithChildren) {
  return <div className="grid grid-cols-1 gap-4 font-zen sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
