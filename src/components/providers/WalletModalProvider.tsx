'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, CheckIcon, ClipboardIcon, ExternalLinkIcon, ReloadIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useConnect, type Connector, type ConnectorEventMap } from 'wagmi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';

type WalletOption = {
  id: string;
  connectorIds: string[];
  name: string;
  description: string;
  iconUrl: string;
};

type WalletModalContextValue = {
  openWalletModal: () => void;
};

const WalletModalContext = createContext<WalletModalContextValue | undefined>(undefined);
type WalletConnectorMessage = ConnectorEventMap['message'];

const WALLET_CONNECT_IDS = ['walletConnect'];
const WALLET_CONNECT_LINK_TIMEOUT_MS = 10_000;
const getFaviconUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const FEATURED_WALLETS: WalletOption[] = [
  {
    id: 'metaMask',
    connectorIds: ['metaMask'],
    name: 'MetaMask',
    description: 'Browser extension or mobile wallet.',
    iconUrl: getFaviconUrl('metamask.io'),
  },
  {
    id: 'rabby',
    connectorIds: ['rabby'],
    name: 'Rabby',
    description: 'Rabby browser extension.',
    iconUrl: getFaviconUrl('rabby.io'),
  },
  {
    id: 'walletConnect',
    connectorIds: WALLET_CONNECT_IDS,
    name: 'WalletConnect',
    description: 'Open a WalletConnect-compatible wallet.',
    iconUrl: getFaviconUrl('walletconnect.com'),
  },
  {
    id: 'ledger',
    connectorIds: WALLET_CONNECT_IDS,
    name: 'Ledger',
    description: 'Connect Ledger Live with WalletConnect.',
    iconUrl: getFaviconUrl('ledger.com'),
  },
  {
    id: 'trezor',
    connectorIds: WALLET_CONNECT_IDS,
    name: 'Trezor',
    description: 'Connect Trezor Suite with WalletConnect.',
    iconUrl: getFaviconUrl('trezor.io'),
  },
  {
    id: 'trustWallet',
    connectorIds: ['trustWallet'],
    name: 'Trust Wallet',
    description: 'Trust Wallet browser or mobile wallet.',
    iconUrl: getFaviconUrl('trustwallet.com'),
  },
  {
    id: 'rainbow',
    connectorIds: ['rainbow'],
    name: 'Rainbow',
    description: 'Rainbow browser or mobile wallet.',
    iconUrl: getFaviconUrl('rainbow.me'),
  },
  {
    id: 'safe',
    connectorIds: ['safe'],
    name: 'Safe',
    description: 'Use Monarch inside the Safe Apps iframe.',
    iconUrl: getFaviconUrl('app.safe.global'),
  },
];

const MORE_WALLETS: WalletOption[] = [
  {
    id: 'coinbaseWallet',
    connectorIds: ['coinbaseWallet'],
    name: 'Coinbase Wallet',
    description: 'Coinbase Wallet extension or app.',
    iconUrl: getFaviconUrl('coinbase.com'),
  },
  {
    id: 'braveWallet',
    connectorIds: ['braveWallet'],
    name: 'Brave Wallet',
    description: 'Built into the Brave browser.',
    iconUrl: getFaviconUrl('brave.com'),
  },
  {
    id: 'okxWallet',
    connectorIds: ['okxWallet'],
    name: 'OKX Wallet',
    description: 'OKX browser or mobile wallet.',
    iconUrl: getFaviconUrl('okx.com'),
  },
  {
    id: 'phantom',
    connectorIds: ['phantom'],
    name: 'Phantom',
    description: 'Phantom multichain wallet.',
    iconUrl: getFaviconUrl('phantom.com'),
  },
  {
    id: 'uniswapWallet',
    connectorIds: ['uniswapWallet'],
    name: 'Uniswap Wallet',
    description: 'Uniswap Wallet extension or app.',
    iconUrl: getFaviconUrl('wallet.uniswap.org'),
  },
  {
    id: 'zerion',
    connectorIds: ['zerion'],
    name: 'Zerion',
    description: 'Zerion browser or mobile wallet.',
    iconUrl: getFaviconUrl('zerion.io'),
  },
  {
    id: 'tokenPocket',
    connectorIds: ['tokenPocket'],
    name: 'TokenPocket',
    description: 'TokenPocket browser or mobile wallet.',
    iconUrl: getFaviconUrl('tokenpocket.pro'),
  },
  {
    id: 'imToken',
    connectorIds: ['imToken'],
    name: 'imToken',
    description: 'imToken mobile wallet.',
    iconUrl: getFaviconUrl('token.im'),
  },
  {
    id: 'frame',
    connectorIds: ['frame'],
    name: 'Frame',
    description: 'Frame desktop wallet.',
    iconUrl: getFaviconUrl('frame.sh'),
  },
  {
    id: 'taho',
    connectorIds: ['taho'],
    name: 'Taho',
    description: 'Taho browser extension.',
    iconUrl: getFaviconUrl('taho.xyz'),
  },
  {
    id: 'enkrypt',
    connectorIds: ['enkrypt'],
    name: 'Enkrypt',
    description: 'Enkrypt browser wallet.',
    iconUrl: getFaviconUrl('enkrypt.com'),
  },
  {
    id: 'backpack',
    connectorIds: ['backpack'],
    name: 'Backpack',
    description: 'Backpack browser or mobile wallet.',
    iconUrl: getFaviconUrl('backpack.app'),
  },
  {
    id: 'injected',
    connectorIds: ['injected'],
    name: 'Browser Wallet',
    description: 'Use another injected browser wallet.',
    iconUrl: getFaviconUrl('ethereum.org'),
  },
];

const WALLET_SECTIONS = [
  { title: 'Recommended', wallets: FEATURED_WALLETS },
  { title: 'More wallets', wallets: MORE_WALLETS },
];

const KNOWN_CONNECTOR_IDS = new Set([...FEATURED_WALLETS, ...MORE_WALLETS].flatMap((option) => option.connectorIds));

function isWalletConnectOption(option: WalletOption): boolean {
  return option.connectorIds.includes('walletConnect');
}

function getConnectorByOption(connectors: readonly Connector[], option: WalletOption): Connector | undefined {
  return connectors.find((connector) => option.connectorIds.includes(connector.id));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Unable to connect wallet.';
}

type WalletConnectProviderWithModal = {
  modal?: {
    close?: () => Promise<void> | void;
  };
};

async function closeWalletConnectPrompt(connector?: Connector): Promise<void> {
  if (!connector || connector.id !== 'walletConnect') return;

  try {
    const provider = (await connector.getProvider()) as WalletConnectProviderWithModal;
    await provider.modal?.close?.();
  } catch {
    // WalletConnect owns this modal. Failure to close it should not block returning to the wallet list.
  }
}

function WalletIcon({ option }: { option: Pick<WalletOption, 'iconUrl' | 'name'> }) {
  const [hasImageError, setHasImageError] = useState(false);
  const fallbackLabel = option.name.slice(0, 1);

  useEffect(() => {
    setHasImageError(false);
  }, [option.iconUrl]);

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-hovered text-sm font-medium text-primary">
      {option.iconUrl && !hasImageError ? (
        <Image
          src={option.iconUrl}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      ) : (
        fallbackLabel
      )}
    </span>
  );
}

function WalletButton({
  connector,
  isPending,
  onConnect,
  option,
}: {
  connector?: Connector;
  isPending: boolean;
  onConnect: (option: WalletOption) => void;
  option: WalletOption;
}) {
  const isUnavailable = !connector && isWalletConnectOption(option);

  return (
    <button
      key={option.id}
      type="button"
      className="flex min-h-[76px] items-center gap-3 rounded-sm border border-primary/10 bg-surface p-3 text-left transition hover:border-primary/30 hover:bg-hovered disabled:cursor-not-allowed disabled:opacity-50"
      onClick={() => onConnect(option)}
      disabled={isPending || isUnavailable}
    >
      <WalletIcon option={option} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-primary">{option.name}</span>
        <span className="text-xs leading-4 text-secondary">{option.description}</span>
      </span>
    </button>
  );
}

function WalletConnectView({
  hasCopiedWalletConnectUri,
  hasLinkTimedOut,
  isPending,
  onCopyLink,
  onBack,
  onRetry,
  option,
  walletConnectUri,
}: {
  hasCopiedWalletConnectUri: boolean;
  hasLinkTimedOut: boolean;
  isPending: boolean;
  onCopyLink: () => void;
  onBack: () => void;
  onRetry: () => void;
  option: WalletOption;
  walletConnectUri: string | null;
}) {
  const statusText = walletConnectUri
    ? 'QR prompt and pairing link ready.'
    : hasLinkTimedOut
      ? 'WalletConnect link was not returned.'
      : isPending
        ? 'Preparing WalletConnect link.'
        : 'WalletConnect prompt closed.';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm border border-primary/10 bg-hovered/40 p-4">
        <div className="flex items-center gap-3">
          <WalletIcon option={option} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="truncate text-sm font-medium text-primary">{option.name}</div>
            <div className="text-xs text-secondary">{statusText}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="surface"
          onClick={onBack}
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          isLoading={isPending}
          size="sm"
          variant="primary"
          onClick={onRetry}
        >
          <ReloadIcon className="h-3.5 w-3.5" />
          Open QR
        </Button>
        <Button
          size="sm"
          variant="surface"
          onClick={onCopyLink}
          disabled={!walletConnectUri}
        >
          {hasCopiedWalletConnectUri ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
          {hasCopiedWalletConnectUri ? 'Copied' : 'Copy link'}
        </Button>
        {walletConnectUri ? (
          <Button
            asChild
            size="sm"
            variant="surface"
          >
            <a href={walletConnectUri}>
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              Open link
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="surface"
            disabled
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            Open link
          </Button>
        )}
      </div>
    </div>
  );
}

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasCopiedWalletConnectUri, setHasCopiedWalletConnectUri] = useState(false);
  const [hasWalletConnectLinkTimedOut, setHasWalletConnectLinkTimedOut] = useState(false);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [walletConnectOption, setWalletConnectOption] = useState<WalletOption | null>(null);
  const [walletConnectUri, setWalletConnectUri] = useState<string | null>(null);
  const connectAttemptRef = useRef(0);
  const { connectors, connectAsync, reset: resetConnectMutation } = useConnect();
  const walletConnectConnector = useMemo(() => connectors.find((connector) => connector.id === 'walletConnect'), [connectors]);

  useEffect(() => {
    if (!walletConnectConnector) return;

    const handleMessage = (message: WalletConnectorMessage) => {
      if (message.type !== 'display_uri' || typeof message.data !== 'string') return;
      setErrorMessage(null);
      setHasWalletConnectLinkTimedOut(false);
      setWalletConnectUri(message.data);
      setHasCopiedWalletConnectUri(false);
    };

    walletConnectConnector.emitter.on('message', handleMessage);
    return () => walletConnectConnector.emitter.off('message', handleMessage);
  }, [walletConnectConnector]);

  const resetModalState = useCallback(() => {
    connectAttemptRef.current += 1;
    setErrorMessage(null);
    setHasCopiedWalletConnectUri(false);
    setHasWalletConnectLinkTimedOut(false);
    setPendingOptionId(null);
    setWalletConnectOption(null);
    setWalletConnectUri(null);
    resetConnectMutation();
  }, [resetConnectMutation]);

  const openWalletModal = useCallback(() => {
    resetModalState();
    setIsOpen(true);
  }, [resetModalState]);

  const contextValue = useMemo(() => ({ openWalletModal }), [openWalletModal]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        void closeWalletConnectPrompt(walletConnectConnector);
        resetModalState();
      }
    },
    [resetModalState, walletConnectConnector],
  );

  const handleBackToWalletList = useCallback(() => {
    void closeWalletConnectPrompt(walletConnectConnector);
    resetModalState();
    setIsOpen(true);
  }, [resetModalState, walletConnectConnector]);

  useEffect(() => {
    if (!walletConnectOption || pendingOptionId !== walletConnectOption.id || walletConnectUri) return;

    const timeoutId = window.setTimeout(() => {
      setHasWalletConnectLinkTimedOut(true);
      setPendingOptionId(null);
      setErrorMessage(
        'WalletConnect did not return a pairing link. Check browser shields, network blockers, or the WalletConnect project ID, then try again.',
      );
      void closeWalletConnectPrompt(walletConnectConnector);
    }, WALLET_CONNECT_LINK_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [pendingOptionId, walletConnectConnector, walletConnectOption, walletConnectUri]);

  const detectedConnectors = useMemo(
    () =>
      connectors
        .filter((connector) => !KNOWN_CONNECTOR_IDS.has(connector.id))
        .map<WalletOption>((connector) => ({
          id: connector.id,
          connectorIds: [connector.id],
          name: connector.name,
          description: 'Detected browser wallet.',
          iconUrl: connector.icon || getFaviconUrl('ethereum.org'),
        })),
    [connectors],
  );

  const handleCopyWalletConnectUri = useCallback(async () => {
    if (!walletConnectUri) return;

    try {
      await navigator.clipboard.writeText(walletConnectUri);
      setHasCopiedWalletConnectUri(true);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Unable to copy WalletConnect link.');
    }
  }, [walletConnectUri]);

  const handleConnect = useCallback(
    async (option: WalletOption) => {
      const connector = getConnectorByOption(connectors, option);
      const usesWalletConnect = isWalletConnectOption(option);
      if (!connector) {
        setErrorMessage(
          usesWalletConnect
            ? 'WalletConnect is not configured. Set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID.'
            : `${option.name} is not available in this browser.`,
        );
        return;
      }

      const attemptId = connectAttemptRef.current + 1;
      connectAttemptRef.current = attemptId;
      setErrorMessage(null);
      if (usesWalletConnect) {
        setHasCopiedWalletConnectUri(false);
        setHasWalletConnectLinkTimedOut(false);
        setWalletConnectUri(null);
      }
      setPendingOptionId(option.id);
      if (usesWalletConnect) setWalletConnectOption(option);

      try {
        await connectAsync({ connector });
        if (connectAttemptRef.current !== attemptId) return;
        handleOpenChange(false);
      } catch (error) {
        if (connectAttemptRef.current !== attemptId) return;
        setIsOpen(true);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (connectAttemptRef.current === attemptId) setPendingOptionId(null);
      }
    },
    [connectAsync, connectors, handleOpenChange],
  );

  const handleRetryWalletConnect = useCallback(() => {
    if (!walletConnectOption || pendingOptionId === walletConnectOption.id) return;
    void handleConnect(walletConnectOption);
  }, [handleConnect, pendingOptionId, walletConnectOption]);

  const walletConnectViewPending = Boolean(walletConnectOption && pendingOptionId === walletConnectOption.id);

  return (
    <WalletModalContext.Provider value={contextValue}>
      {children}
      <Modal
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        title="Connect Wallet"
        size="lg"
      >
        {(onClose) => (
          <>
            {walletConnectOption ? (
              <ModalHeader
                title={walletConnectOption.name}
                description="WalletConnect opens its QR prompt in front of Monarch."
                auxiliaryAction={{
                  ariaLabel: 'Back to wallet list',
                  icon: <ArrowLeftIcon className="h-3.5 w-3.5" />,
                  onClick: handleBackToWalletList,
                }}
                onClose={onClose}
              />
            ) : (
              <ModalHeader
                title="Connect Wallet"
                description="Choose a wallet to connect to Monarch."
                onClose={onClose}
              />
            )}
            <ModalBody className="gap-5">
              {walletConnectOption ? (
                <WalletConnectView
                  hasCopiedWalletConnectUri={hasCopiedWalletConnectUri}
                  hasLinkTimedOut={hasWalletConnectLinkTimedOut}
                  isPending={walletConnectViewPending}
                  onBack={handleBackToWalletList}
                  onCopyLink={handleCopyWalletConnectUri}
                  onRetry={handleRetryWalletConnect}
                  option={walletConnectOption}
                  walletConnectUri={walletConnectUri}
                />
              ) : (
                [...WALLET_SECTIONS, ...(detectedConnectors.length > 0 ? [{ title: 'Detected', wallets: detectedConnectors }] : [])].map(
                  (section) => (
                    <section
                      key={section.title}
                      className="space-y-2"
                    >
                      <h3 className="text-xs font-medium uppercase text-secondary">{section.title}</h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {section.wallets.map((option) => (
                          <WalletButton
                            key={option.id}
                            connector={getConnectorByOption(connectors, option)}
                            isPending={pendingOptionId === option.id}
                            onConnect={(walletOption) => {
                              void handleConnect(walletOption);
                            }}
                            option={option}
                          />
                        ))}
                      </div>
                    </section>
                  ),
                )
              )}

              {errorMessage ? <div className="rounded-sm bg-danger/10 p-3 text-sm text-danger">{errorMessage}</div> : null}
            </ModalBody>
          </>
        )}
      </Modal>
    </WalletModalContext.Provider>
  );
}

export function useWalletModal(): WalletModalContextValue {
  const context = useContext(WalletModalContext);
  if (!context) {
    throw new Error('useWalletModal must be used within WalletModalProvider');
  }
  return context;
}
