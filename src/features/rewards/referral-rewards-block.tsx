'use client';

import { useEffect, useMemo, useState } from 'react';
import { RiCheckLine, RiFileCopyLine, RiSparklingFill } from 'react-icons/ri';
import { getAddress, type Address } from 'viem';
import { useChainId, useConnection, useSignMessage } from 'wagmi';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { buildReferralCodeRequestMessage } from '@/utils/referralRequest';
import { createRequestNonce } from '@/utils/requestNonce';

interface ReferralCodeResponse {
  code?: string;
  error?: string;
}

interface ReferralRewardsBlockProps {
  account: Address;
}

type ReferralRequestState = 'idle' | 'signing' | 'creating';

export function ReferralRewardsBlock({ account }: ReferralRewardsBlockProps) {
  const { address } = useConnection();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<ReferralRequestState>('idle');
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isConnectedWallet = !!address && address.toLowerCase() === account.toLowerCase();
  const normalizedAddress = useMemo(() => {
    if (!address) return null;

    try {
      return getAddress(address);
    } catch {
      return null;
    }
  }, [address]);

  const referralUrl = useMemo(() => {
    if (!code || typeof window === 'undefined') return null;
    return `${window.location.origin}/?ref=${code}`;
  }, [code]);
  const isRequesting = requestState !== 'idle';

  useEffect(() => {
    setCode(null);
    setError(null);
    setRequestState('idle');
    setCopied(false);
    setIsModalOpen(false);
  }, [address, account]);

  const requestReferralCode = async (): Promise<string | null> => {
    if (!normalizedAddress || isRequesting) return null;
    if (referralUrl) return referralUrl;

    setError(null);

    try {
      setRequestState('signing');
      const message = buildReferralCodeRequestMessage({
        wallet: normalizedAddress,
        chainId,
        origin: window.location.origin,
        issuedAt: new Date().toISOString(),
        nonce: createRequestNonce(),
      });
      const signature = await signMessageAsync({ message });

      setRequestState('creating');
      const response = await fetch('/api/referrals/code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: normalizedAddress,
          signature,
          message,
        }),
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
      setRequestState('idle');
    }
  };

  const handleReferralClick = async () => {
    setCopied(false);

    const url = referralUrl ?? (await requestReferralCode());
    if (url) {
      setCopied(await copyText(url));
    }
  };

  const handleReferralUrlCopy = async () => {
    if (!referralUrl) return;
    setCopied(await copyText(referralUrl));
  };

  if (!isConnectedWallet) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-secondary">
        <RiSparklingFill
          className="h-3.5 w-3.5"
          color={MONARCH_PRIMARY}
        />
        Referral Share
      </span>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        aria-label="Open referral share details"
        className="w-fit tabular-nums text-lg text-primary transition hover:text-primary/70 sm:self-end"
      >
        $0.00
      </button>

      <Modal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Referral Share"
        size="md"
      >
        {(onClose) => (
          <>
            <ModalHeader
              title="Referral Share"
              description="Referral attribution is tracked after a referred wallet completes a Monarch transaction."
              mainIcon={
                <RiSparklingFill
                  className="h-4 w-4"
                  color={MONARCH_PRIMARY}
                />
              }
              onClose={onClose}
            />
            <ModalBody className="gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-secondary">Accrued</div>
                  <div className="mt-1 text-lg tabular-nums">$0.00</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-secondary">Share</div>
                  <div className="mt-1 text-lg tabular-nums">40%</div>
                </div>
              </div>

              {referralUrl ? (
                <button
                  type="button"
                  onClick={handleReferralUrlCopy}
                  className="group flex min-w-0 items-center gap-2 rounded bg-hovered px-2.5 py-2 text-left transition hover:bg-hovered/80"
                  aria-label={copied ? 'Referral link copied' : 'Copy referral link'}
                >
                  <code className="min-w-0 flex-1 truncate font-monospace text-[11px] leading-5 text-primary/80">{referralUrl}</code>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-secondary transition group-hover:text-primary">
                    {copied ? <RiCheckLine className="h-4 w-4" /> : <RiFileCopyLine className="h-4 w-4" />}
                  </span>
                </button>
              ) : (
                <p className="text-sm leading-6 text-secondary">
                  Create a referral link now. Fee-share balances will show here when payouts go live.
                </p>
              )}

              {error ? <span className="text-sm text-red-500">{error}</span> : null}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="primary"
                size="md"
                onClick={handleReferralClick}
                isLoading={isRequesting}
                disabled={isRequesting}
              >
                {copied ? <RiCheckLine className="h-4 w-4" /> : <RiFileCopyLine className="h-4 w-4" />}
                {getReferralActionLabel({ copied, hasCode: Boolean(code), requestState })}
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}

function getReferralActionLabel({
  copied,
  hasCode,
  requestState,
}: {
  copied: boolean;
  hasCode: boolean;
  requestState: ReferralRequestState;
}) {
  if (copied) return 'Copied';
  if (requestState === 'signing') return 'Sign in wallet';
  if (requestState === 'creating') return 'Creating link';
  if (hasCode) return 'Copy link';
  return 'Create link';
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
