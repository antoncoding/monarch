import { Suspense } from 'react';
import StatsPageClient from './stats-page-client';

const LoadingFallback = () => (
  <div className="container mx-auto px-4 py-8">
    <div className="text-muted-foreground text-sm">Loading statistics...</div>
  </div>
);

export default function StatsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StatsPageClient />
    </Suspense>
  );
}
