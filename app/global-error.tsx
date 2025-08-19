'use client';

import { Button } from '@/components/common';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-2xl">Something went wrong</h2>
          <p className="max-w-xl text-secondary">
            An unexpected error occurred. Please try again. If the issue persists, it may be due to
            a transient data source outage.
          </p>
          <pre className="max-w-xl overflow-auto rounded bg-content3 p-4 text-left text-xs">
            {error?.message ?? 'Unknown error'}
          </pre>
          <Button onPress={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}



