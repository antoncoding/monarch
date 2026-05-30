'use client';

import { useMemo, useState } from 'react';
import { RiCheckLine, RiFileCopyLine, RiSparkling2Line } from 'react-icons/ri';
import { useConnection } from 'wagmi';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { Button } from '@/components/ui/button';

interface ReferralCodeResponse {
  code?: string;
  error?: string;
}

export function ReferralRewardsSection() {
  const { address } = useConnection();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const referralUrl = useMemo(() => {
    if (!code || typeof window === 'undefined') return null;
    return `${window.location.origin}/?ref=${code}`;
  }, [code]);

  const handleOpen = async () => {
    setIsOpen(true);
    setCopied(false);

    if (!address || code || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/referrals/code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ referrerWallet: address }),
      });
      const body = (await response.json().catch(() => ({}))) as ReferralCodeResponse;

      if (!response.ok || !body.code) {
        throw new Error(body.error ?? 'Unable to create referral code.');
      }

      setCode(body.code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create referral code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!referralUrl) return;
    setCopied(await copyText(referralUrl));
  };

  return (
    <section className="mt-6 rounded border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-secondary">
            <RiSparkling2Line className="h-4 w-4 text-primary" />
            Referral Rewards
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            Share Monarch. When referred wallets pay platform fees, your referral share will be tracked automatically.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 sm:min-w-[260px]">
          <div>
            <div className="text-xs uppercase tracking-wider text-secondary">Earned</div>
            <div className="mt-1 text-lg tabular-nums text-primary">$0.00</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-secondary">Fee Share</div>
            <div className="mt-1 text-lg tabular-nums text-primary">40%</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {address ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleOpen}
            isLoading={isLoading}
            disabled={isLoading}
          >
            <RiSparkling2Line className="h-4 w-4" />
            Create referral link
          </Button>
        ) : (
          <div className="[&>div]:flex-grow-0">
            <AccountConnect onConnectPath="rewards" />
          </div>
        )}
        <span className="text-xs text-secondary">Fee sharing is not live yet. Referral links can be created now.</span>
      </div>

      {isOpen && address ? (
        <div className="mt-4 border-t border-border pt-4">
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {referralUrl ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate rounded bg-hovered px-3 py-2 font-monospace text-xs text-primary">
                {referralUrl}
              </code>
              <Button
                variant="surface"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? <RiCheckLine className="h-4 w-4" /> : <RiFileCopyLine className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
