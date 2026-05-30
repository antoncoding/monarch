'use client';

import { useEffect, useMemo, useState } from 'react';
import { RiCheckLine, RiFileCopyLine, RiSparkling2Line } from 'react-icons/ri';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';

interface ReferralCodeResponse {
  code?: string;
  error?: string;
}

interface ReferralRewardsBlockProps {
  account: Address;
}

export function ReferralRewardsBlock({ account }: ReferralRewardsBlockProps) {
  const { address } = useConnection();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const canCreateReferral = !!address && address.toLowerCase() === account.toLowerCase();

  const referralUrl = useMemo(() => {
    if (!code || typeof window === 'undefined') return null;
    return `${window.location.origin}/?ref=${code}`;
  }, [code]);

  useEffect(() => {
    setCode(null);
    setError(null);
    setCopied(false);
  }, [address, account]);

  const requestReferralCode = async (): Promise<string | null> => {
    if (!address || isLoading) return null;
    if (referralUrl) return referralUrl;

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
      return `${window.location.origin}/?ref=${body.code}`;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create referral code.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleReferralClick = async () => {
    setCopied(false);

    const url = referralUrl ?? (await requestReferralCode());
    if (url) {
      setCopied(await copyText(url));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-secondary">
        <RiSparkling2Line className="h-3.5 w-3.5 text-primary" />
        Referral Share
      </span>
      <div className="flex flex-wrap items-center gap-2 text-lg sm:justify-end">
        <span className="tabular-nums">$0.00</span>
        <span className="rounded bg-hovered px-2 py-0.5 text-xs text-secondary">40%</span>
        {canCreateReferral ? (
          <Button
            variant="surface"
            size="xs"
            onClick={handleReferralClick}
            isLoading={isLoading}
            disabled={isLoading}
            aria-label="Create or copy referral link"
          >
            {copied ? <RiCheckLine className="h-4 w-4" /> : <RiFileCopyLine className="h-4 w-4" />}
            {copied ? 'Copied' : code ? 'Copy link' : 'Create link'}
          </Button>
        ) : null}
      </div>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </div>
  );
}

async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back to the textarea path below for non-secure contexts.
    }
  }

  if (typeof document === 'undefined') return false;

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textArea);
  }
}
