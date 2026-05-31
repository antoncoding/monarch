'use client';

import { useEffect, useRef, useState } from 'react';
import { RiCheckLine, RiSparklingFill } from 'react-icons/ri';
import { LuCopy } from 'react-icons/lu';
import { getAddress, type Address } from 'viem';
import { useConnection, useSignMessage } from 'wagmi';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { getOwnReferralCode, storeOwnReferralCode } from '@/utils/referrals';
import { getWalletSignatureMessage } from '@/utils/walletSignature';

interface ReferralCodeResponse {
  code?: string;
  error?: string;
}

type ReferralRequestState = 'idle' | 'signing' | 'loading';

export function ReferralRewardsBlock({ account }: { account: Address }) {
  const { address } = useConnection();
  const { signMessageAsync } = useSignMessage();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<ReferralRequestState>('idle');
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const referralInputRef = useRef<HTMLInputElement>(null);

  const isConnectedWallet = Boolean(address && address.toLowerCase() === account.toLowerCase());
  const referralUrl = code && typeof window !== 'undefined' ? `${window.location.origin}/?ref=${code}` : null;
  const isRequesting = requestState !== 'idle';
  let actionLabel = 'Create link';
  if (requestState === 'loading') actionLabel = 'Loading link';
  if (requestState === 'signing') actionLabel = 'Sign in wallet';

  useEffect(() => {
    setError(null);
    setRequestState('idle');
    setCopied(false);
    setIsModalOpen(false);

    if (address && address.toLowerCase() === account.toLowerCase()) {
      setCode(getOwnReferralCode(address));
      return;
    }

    setCode(null);
  }, [address, account]);

  const createReferralLink = async () => {
    if (!address || isRequesting || referralUrl) return;

    setError(null);

    try {
      const wallet = getAddress(address);
      const timestamp = Date.now();
      const message = getWalletSignatureMessage({
        purpose: 'referral link',
        wallet,
        timestamp,
      });

      setRequestState('signing');
      const signature = await signMessageAsync({ message });

      setRequestState('loading');
      const response = await fetch('/api/referrals/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet, signature, timestamp }),
      });
      const body = (await response.json().catch(() => ({}))) as ReferralCodeResponse;

      if (!response.ok || !body.code) {
        throw new Error(body.error ?? 'Unable to create referral code.');
      }

      setCode(body.code);
      storeOwnReferralCode(wallet, body.code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create referral code.');
    } finally {
      setRequestState('idle');
    }
  };

  const copyReferralLink = () => {
    const input = referralInputRef.current;
    if (!input) return;

    setError(null);
    setCopied(false);
    input.focus();
    input.select();

    try {
      if (!document.execCommand('copy')) throw new Error('copy failed');
      setCopied(true);
    } catch {
      setError('Select the link and copy it manually.');
    }
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
        aria-label="Open referral share"
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
              description="Share Monarch. Referral balances will appear here when payouts go live."
              mainIcon={
                <RiSparklingFill
                  className="h-4 w-4"
                  color={MONARCH_PRIMARY}
                />
              }
              onClose={onClose}
            />
            <ModalBody className="gap-3">
              <div className="text-sm text-secondary">Fee share: 40%</div>
              {referralUrl ? (
                <div className="flex min-w-0 items-center gap-2 rounded bg-hovered px-2.5 py-2">
                  <input
                    ref={referralInputRef}
                    readOnly
                    value={referralUrl}
                    aria-label="Referral link"
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 bg-transparent font-monospace text-[11px] leading-5 text-primary/80 outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyReferralLink}
                    aria-label={copied ? 'Referral link copied' : 'Copy referral link'}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-secondary transition hover:text-primary"
                  >
                    {copied ? <RiCheckLine className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
                  </button>
                </div>
              ) : null}

              {error ? <span className="text-sm text-red-500">{error}</span> : null}
            </ModalBody>
            <ModalFooter>
              {referralUrl ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={copyReferralLink}
                >
                  {copied ? <RiCheckLine className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={createReferralLink}
                  isLoading={isRequesting}
                  disabled={isRequesting}
                >
                  {actionLabel}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
