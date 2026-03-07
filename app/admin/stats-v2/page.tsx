import { Suspense } from 'react';
import StatsV2PageClient from './stats-v2-page-client';

const LoadingFallback = () => (
  <div className="container mx-auto px-4 py-8">
    <div className="text-muted-foreground text-sm">Loading statistics...</div>
  </div>
);

export default function StatsV2Page() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StatsV2PageClient />
    </Suspense>
  );
}
