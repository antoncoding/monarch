'use client';

import { useEffect } from 'react';
// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl">Something went wrong</h2>
      <p className="max-w-xl text-secondary">This page failed to load some data. Please try again.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
