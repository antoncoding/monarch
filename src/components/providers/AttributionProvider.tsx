'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConnectionEffect } from 'wagmi';
import { useAttributionStore } from '@/stores/useAttributionStore';

const RESUBMIT_WINDOW_MS = 6 * 60 * 60 * 1000;

type AttributionProviderProps = {
  children: ReactNode;
};

async function submitTouchpoint(payload: Record<string, unknown>): Promise<void> {
  await fetch('/api/monarch/attribution/touchpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function AttributionProvider({ children }: AttributionProviderProps) {
  const pathname = usePathname();

  const touchpoint = useAttributionStore((state) => state.touchpoint);
  const lastSubmittedWallet = useAttributionStore((state) => state.lastSubmittedWallet);
  const lastSubmittedAt = useAttributionStore((state) => state.lastSubmittedAt);
  const captureFromUrl = useAttributionStore((state) => state.captureFromUrl);
  const markSubmittedWallet = useAttributionStore((state) => state.markSubmittedWallet);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    captureFromUrl(params, pathname);
  }, [captureFromUrl, pathname]);

  useConnectionEffect({
    onConnect: ({ address, chainId, isReconnected }) => {
      const normalizedWallet = address.toLowerCase();
      const submittedRecently =
        lastSubmittedWallet === normalizedWallet &&
        typeof lastSubmittedAt === 'number' &&
        Date.now() - lastSubmittedAt < RESUBMIT_WINDOW_MS;

      if (submittedRecently) {
        return;
      }

      void submitTouchpoint({
        walletAddress: normalizedWallet,
        chainId,
        refCode: touchpoint?.refCode ?? undefined,
        utmSource: touchpoint?.utmSource ?? undefined,
        utmMedium: touchpoint?.utmMedium ?? undefined,
        utmCampaign: touchpoint?.utmCampaign ?? undefined,
        utmContent: touchpoint?.utmContent ?? undefined,
        landingPath: touchpoint?.landingPath ?? pathname,
        metadata: {
          isReconnected,
        },
      })
        .then(() => {
          markSubmittedWallet(normalizedWallet);
        })
        .catch(() => {
          // Keep silent; failures are surfaced in backend telemetry and retried on next connect.
        });
    },
  });

  return <>{children}</>;
}
