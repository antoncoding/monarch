'use client';

import { useEffect } from 'react';
import { Button } from '@/components/common';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service in production if desired
    console.error('App error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl">Something went wrong</h2>
      <p className="max-w-xl text-secondary">
        This page failed to load some data. Please try again.
      </p>
      <Button onPress={reset}>Retry</Button>
    </div>
  );
}


