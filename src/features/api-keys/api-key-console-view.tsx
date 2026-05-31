'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RiCheckLine, RiFileCopyLine, RiKey2Line } from 'react-icons/ri';
import { getAddress } from 'viem';
import { useConnection, useSignMessage } from 'wagmi';
import AccountConnect from '@/components/layout/header/AccountConnect';
import Header from '@/components/layout/header/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EXTERNAL_LINKS } from '@/utils/external';
import { getWalletSignatureMessage } from '@/utils/walletSignature';

interface CreatedApiKey {
  apiKey: string;
  key?: {
    name?: string;
  };
}

type CreationState = 'idle' | 'signing' | 'creating' | 'created' | 'error';

export function ApiKeyConsoleView() {
  const { address, isConnected } = useConnection();
  const { signMessageAsync } = useSignMessage();
  const [keyName, setKeyName] = useState('Default API key');
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [creationState, setCreationState] = useState<CreationState>('idle');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const normalizedAddress = useMemo(() => {
    if (!address) return null;

    try {
      return getAddress(address);
    } catch {
      return null;
    }
  }, [address]);

  const isCreating = creationState === 'signing' || creationState === 'creating';

  const handleCreateKey = async () => {
    if (!isConnected || !normalizedAddress) {
      return;
    }

    setCreationError(null);
    setCopied(false);
    setCreatedKey(null);

    try {
      setCreationState('signing');
      const timestamp = Date.now();
      const message = getWalletSignatureMessage({
        purpose: 'API key',
        wallet: normalizedAddress,
        timestamp,
      });
      const signature = await signMessageAsync({ message });

      setCreationState('creating');
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: normalizedAddress,
          signature,
          timestamp,
          name: keyName,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as Partial<CreatedApiKey> & {
        error?: string;
      };

      if (!response.ok || typeof body.apiKey !== 'string') {
        throw new Error(body.error ?? 'API key creation failed.');
      }

      const nextCreatedKey = {
        apiKey: body.apiKey,
        key: body.key,
      };
      setCreatedKey(nextCreatedKey);
      setCreationState('created');
    } catch (caught) {
      setCreationState('error');
      setCreationError(caught instanceof Error ? caught.message : 'API key creation failed.');
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;

    setCopied(await copyText(createdKey.apiKey));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="px-4 pb-16 pt-28 font-zen sm:px-6 lg:px-8">
        <section className="mx-auto flex max-w-3xl flex-col gap-5">
          <div className="flex flex-col gap-3 px-5">
            <div className="flex items-center gap-2 font-monospace text-xs uppercase tracking-[0.18em] text-secondary">
              <RiKey2Line className="h-4 w-4 text-primary" />
              API Access
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-zen text-3xl font-normal leading-tight text-primary sm:text-4xl">API Keys</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">Generate a key, copy it, and store it securely.</p>
              </div>
              <Link
                href={EXTERNAL_LINKS.apiDocs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-secondary no-underline transition-colors hover:text-primary hover:no-underline"
              >
                API Docs
              </Link>
            </div>
          </div>

          <section className="rounded border border-border bg-surface shadow-sm">
            <div className="flex flex-col gap-5 p-5">
              <Input
                id="api-key-name"
                label="Key name"
                value={keyName}
                onValueChange={setKeyName}
                placeholder="Production dashboard"
                maxLength={120}
              />

              {creationError ? (
                <div className="rounded border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">{creationError}</div>
              ) : null}

              {isConnected ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  isLoading={isCreating}
                  disabled={isCreating}
                  onClick={handleCreateKey}
                  className="w-full sm:w-fit"
                >
                  <RiKey2Line />
                  {getActionLabel(creationState)}
                </Button>
              ) : (
                <div className="[&>div]:flex-grow-0">
                  <AccountConnect />
                </div>
              )}

              {createdKey ? (
                <div className="rounded border border-border bg-background">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">{createdKey.key?.name ?? keyName}</div>
                      <div className="mt-1 text-xs text-secondary">Shown once. Store it now.</div>
                    </div>
                    <Button
                      type="button"
                      variant="surface"
                      size="sm"
                      onClick={handleCopy}
                    >
                      {copied ? <RiCheckLine /> : <RiFileCopyLine />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="p-4">
                    <code className="block max-h-32 overflow-auto break-all rounded bg-hovered p-3 font-monospace text-xs text-primary">
                      {createdKey.apiKey}
                    </code>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function getActionLabel(state: CreationState) {
  if (state === 'signing') return 'Sign in wallet';
  if (state === 'creating') return 'Creating key';
  if (state === 'created') return 'Generate another';
  return 'Generate key';
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
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
