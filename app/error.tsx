'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl">Something went wrong</h2>
      <p className="max-w-xl text-secondary">This page failed to load some data. Please try again.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
