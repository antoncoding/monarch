'use client';

import { useMemo, useState } from 'react';
import { useAppKit } from '@reown/appkit/react';
import Link from 'next/link';
import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiKey2Line,
  RiPlayLine,
  RiWallet3Line,
} from 'react-icons/ri';
import { getAddress } from 'viem';
import { useConnection, useSignMessage } from 'wagmi';
import Header from '@/components/layout/header/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildApiKeyRequestMessage } from '@/utils/apiKeyRequest';
import { EXTERNAL_LINKS } from '@/utils/external';

type CreatedApiKey = {
  apiKey: string;
  key?: {
    name?: string;
  };
};

type TestResult = {
  ok: boolean;
  status?: number;
  endpoint?: string;
  total?: number | null;
  sampleCount?: number | null;
  error?: string;
};

type CreationState = 'idle' | 'signing' | 'creating' | 'created' | 'error';
type TestState = 'idle' | 'testing' | 'success' | 'error';

export function ApiKeyConsoleView() {
  const { open } = useAppKit();
  const { address, isConnected } = useConnection();
  const { signMessageAsync } = useSignMessage();
  const [keyName, setKeyName] = useState('Default API key');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [creationState, setCreationState] = useState<CreationState>('idle');
  const [testState, setTestState] = useState<TestState>('idle');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
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
  const isTesting = testState === 'testing';

  const handleCreateKey = async () => {
    if (!isConnected || !normalizedAddress) {
      open();
      return;
    }

    setCreationError(null);
    setCopied(false);
    setCreatedKey(null);
    setTestResult(null);

    try {
      setCreationState('signing');
      const message = buildApiKeyRequestMessage({
        wallet: normalizedAddress,
        origin: window.location.origin,
        issuedAt: new Date().toISOString(),
        nonce: crypto.randomUUID(),
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
          message,
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
      setApiKeyInput(nextCreatedKey.apiKey);
      setCreationState('created');
    } catch (caught) {
      setCreationState('error');
      setCreationError(caught instanceof Error ? caught.message : 'API key creation failed.');
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;

    await navigator.clipboard.writeText(createdKey.apiKey);
    setCopied(true);
  };

  const handleApiKeyInputChange = (value: string) => {
    setApiKeyInput(value);
    setTestResult(null);
    setTestState('idle');
  };

  const handleTestKey = async () => {
    setTestState('testing');
    setTestResult(null);

    try {
      const response = await fetch('/api/api-keys/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      const body = (await response.json().catch(() => ({}))) as TestResult;

      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? 'API key test failed.');
      }

      setTestResult(body);
      setTestState('success');
    } catch (caught) {
      setTestResult({
        ok: false,
        error: caught instanceof Error ? caught.message : 'API key test failed.',
      });
      setTestState('error');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="px-4 pb-16 pt-28 font-zen sm:px-6 lg:px-8">
        <section className="mx-auto flex max-w-3xl flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-monospace text-xs uppercase tracking-[0.18em] text-secondary">
              <RiKey2Line className="h-4 w-4 text-primary" />
              API Access
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-zen text-3xl font-normal leading-tight text-primary sm:text-4xl">API Keys</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
                  Generate a key, copy it, then test one request.
                </p>
              </div>
              <Button
                asChild
                variant="surface"
                size="sm"
              >
                <Link
                  href={EXTERNAL_LINKS.docs}
                  target="_blank"
                  rel="noreferrer"
                >
                  Docs
                  <RiExternalLinkLine />
                </Link>
              </Button>
            </div>
          </div>

          <section className="rounded border border-border bg-surface shadow-sm">
            <div className="flex flex-col gap-5 p-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Input
                  id="api-key-name"
                  label="Key name"
                  value={keyName}
                  onValueChange={setKeyName}
                  placeholder="Production dashboard"
                  maxLength={120}
                />
                <Button
                  type="button"
                  variant="surface"
                  size="md"
                  onClick={() => open()}
                >
                  <RiWallet3Line />
                  {normalizedAddress ? 'Switch wallet' : 'Connect wallet'}
                </Button>
              </div>

              {normalizedAddress ? (
                <div className="truncate rounded bg-background px-3 py-2 font-monospace text-xs text-secondary">
                  {normalizedAddress}
                </div>
              ) : null}

              {creationError ? (
                <div className="rounded border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500">
                  {creationError}
                </div>
              ) : null}

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
                {getActionLabel({ isConnected, state: creationState })}
              </Button>

              {createdKey ? (
                <div className="rounded border border-border bg-background">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">
                        {createdKey.key?.name ?? keyName}
                      </div>
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

          <section className="rounded border border-border bg-surface shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-medium text-primary">Test key</h2>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <Input
                id="api-key-test"
                label="API key"
                value={apiKeyInput}
                onValueChange={handleApiKeyInputChange}
                placeholder="mk_live_..."
                autoComplete="off"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="surface"
                  size="md"
                  isLoading={isTesting}
                  disabled={isTesting || !apiKeyInput.trim()}
                  onClick={handleTestKey}
                  className="w-full sm:w-fit"
                >
                  <RiPlayLine />
                  Run test query
                </Button>
                <code className="break-all font-monospace text-xs text-secondary">
                  GET /v1/markets/metrics?limit=1&amp;offset=0
                </code>
              </div>

              {testResult ? (
                <div
                  className={
                    testState === 'success'
                      ? 'rounded border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-600 dark:text-green-400'
                      : 'rounded border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500'
                  }
                >
                  {testState === 'success'
                    ? `OK ${testResult.status}. Returned ${testResult.sampleCount ?? 0} sample market out of ${testResult.total ?? 'unknown'}.`
                    : testResult.error}
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function getActionLabel({
  isConnected,
  state,
}: {
  isConnected: boolean;
  state: CreationState;
}) {
  if (!isConnected) return 'Connect wallet';
  if (state === 'signing') return 'Sign in wallet';
  if (state === 'creating') return 'Creating key';
  if (state === 'created') return 'Generate another';
  return 'Generate key';
}
