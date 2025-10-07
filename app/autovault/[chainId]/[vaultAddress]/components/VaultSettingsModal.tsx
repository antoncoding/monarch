import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import { Input } from '@heroui/react';
import { createPortal } from 'react-dom';
import { LuX } from 'react-icons/lu';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { AutovaultData } from '@/hooks/useAutovaultData';

type SettingsTab = 'general' | 'agents' | 'allocations';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'agents', label: 'Agent' },
  { id: 'allocations', label: 'Allocation' },
];

type VaultSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  vault: AutovaultData;
  isOwner: boolean;
  onUpdateMetadata: (values: { name?: string; symbol?: string }) => Promise<boolean>;
  updatingMetadata: boolean;
  defaultName: string;
  defaultSymbol: string;
  currentName: string;
  currentSymbol: string;
};

export function VaultSettingsModal({
  isOpen,
  onClose,
  initialTab = 'general',
  vault,
  isOwner,
  onUpdateMetadata,
  updatingMetadata,
  defaultName,
  defaultSymbol,
  currentName,
  currentSymbol,
}: VaultSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const nameInputId = useId();
  const symbolInputId = useId();
  const previousName = useMemo(() => currentName.trim(), [currentName]);
  const previousSymbol = useMemo(() => currentSymbol.trim(), [currentSymbol]);
  const [nameInput, setNameInput] = useState(previousName || defaultName);
  const [symbolInput, setSymbolInput] = useState(previousSymbol || defaultSymbol);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;

    if (isOpen && !wasOpen) {
      setActiveTab(initialTab);
    }

    if (!isOpen && wasOpen) {
      setMetadataError(null);
      setNameInput(previousName || defaultName);
      setSymbolInput(previousSymbol || defaultSymbol);
    }

    wasOpenRef.current = isOpen;
  }, [defaultName, defaultSymbol, initialTab, isOpen, previousName, previousSymbol]);

  const handleTabChange = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
  }, []);

  const trimmedName = nameInput.trim();
  const trimmedSymbol = symbolInput.trim();
  const metadataChanged = useMemo(() => {
    const hasNewName = trimmedName !== previousName;
    const hasNewSymbol = trimmedSymbol !== previousSymbol;
    return hasNewName || hasNewSymbol;
  }, [previousName, previousSymbol, trimmedName, trimmedSymbol]);

  const allocatorCount = vault.agents.length;

  useEffect(() => {
    if (metadataError && metadataChanged) {
      setMetadataError(null);
    }
  }, [metadataChanged, metadataError]);

  const handleMetadataSubmit = useCallback(async () => {
    if (!metadataChanged) {
      setMetadataError('No changes detected.');
      return;
    }

    setMetadataError(null);

    const success = await onUpdateMetadata({
      name: trimmedName !== previousName ? trimmedName || undefined : undefined,
      symbol: trimmedSymbol !== previousSymbol ? trimmedSymbol || undefined : undefined,
    });

    if (success) {
      setMetadataError(null);
    }
  }, [metadataChanged, onUpdateMetadata, previousName, previousSymbol, trimmedName, trimmedSymbol]);

  const renderGeneralTab = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[11px] uppercase text-secondary" htmlFor={nameInputId}>
            Vault name
          </label>
          <Input
            size="sm"
            radius="sm"
            variant="flat"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            placeholder={defaultName}
            isDisabled={!isOwner}
            id={nameInputId}
            classNames={{
              input: 'text-sm',
              inputWrapper:
                'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
            }}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] uppercase text-secondary" htmlFor={symbolInputId}>
            Vault symbol
          </label>
          <Input
            size="sm"
            radius="sm"
            variant="flat"
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder={defaultSymbol}
            maxLength={16}
            isDisabled={!isOwner}
            id={symbolInputId}
            classNames={{
              input: 'text-sm',
              inputWrapper:
                'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
            }}
          />
        </div>

        {metadataError && <p className="text-xs text-danger">{metadataError}</p>}

        <Button
          className="ml-auto"
          variant="interactive"
          size="sm"
          isDisabled={!metadataChanged || updatingMetadata || !isOwner}
          onPress={() => void handleMetadataSubmit()}
        >
          {updatingMetadata ? (
            <span className="flex items-center gap-2">
              <Spinner size={12} /> Saving...
            </span>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </div>
  );

  const renderAgentTab = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm text-secondary">Automation agent</h3>
        <p className="text-xs text-secondary">
          Authorize the allocator address that executes deposits and withdrawals between enabled adapters.
        </p>
      </div>
      <div className="rounded bg-hovered/40 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-secondary">
            {allocatorCount === 0
              ? 'No allocator assigned yet'
              : `${allocatorCount} allocator${allocatorCount > 1 ? 's' : ''} authorized`}
          </span>
          <Button variant="interactive" size="sm">
            {allocatorCount === 0 ? 'Add allocator' : 'Update allocators'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-secondary">
          Allocators handle on-chain execution based on the curator’s guardrails. Add your automation agent or desk wallet
          here so it can rebalance adapters.
        </p>
      </div>
    </div>
  );

  const renderAllocationsTab = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm text-secondary">Allocation caps</h3>
        <p className="text-xs text-secondary">Configure market-level caps and guardrails for the automation agent.</p>
      </div>
      <div className="rounded bg-hovered/40 p-4 text-sm text-secondary">
        Allocation management coming soon. You’ll be able to set per-market caps and minimum cash buffers here.
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralTab();
      case 'agents':
        return renderAgentTab();
      case 'allocations':
        return renderAllocationsTab();
      default:
        return null;
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setNameInput(previousName || defaultName);
      setSymbolInput(previousSymbol || defaultSymbol);
    }
  }, [defaultName, defaultSymbol, isOpen, previousName, previousSymbol]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4 font-zen"
      onMouseDown={onClose}
    >
      <div
        className="relative flex w-full max-w-4xl min-h-[480px] overflow-hidden rounded-2xl border border-divider/20 bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-1 flex-col bg-background/95">
          <div className="flex items-center justify-between border-b border-divider/30 px-8 pt-8 pb-4">
            <h2 className="text-2xl font-normal">Vault Settings</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-hovered text-secondary transition-colors hover:text-primary"
              aria-label="Close settings"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <aside className="flex w-40 flex-col gap-2 border-r border-divider/30 bg-hovered/40 p-6">
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`rounded px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      isActive ? 'bg-primary/15 text-primary' : 'text-secondary hover:bg-hovered'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </aside>

            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-6">
              <div className="min-h-[320px] space-y-6">{renderActiveTab()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
