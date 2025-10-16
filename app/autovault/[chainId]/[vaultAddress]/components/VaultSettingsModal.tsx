import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuX } from 'react-icons/lu';
import { Address } from 'viem';
import { VaultV2Cap } from '@/data-sources/subgraph/v2-vaults';
import { SupportedNetworks } from '@/utils/networks';
import { GeneralTab, AgentsTab, AllocationsTab, SettingsTab } from './settings';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'agents', label: 'Agent' },
  { id: 'allocations', label: 'Allocation' },
];

type VaultSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  isOwner: boolean;
  onUpdateMetadata: (values: { name?: string; symbol?: string }) => Promise<boolean>;
  updatingMetadata: boolean;
  defaultName: string;
  defaultSymbol: string;
  currentName: string;
  currentSymbol: string;
  owner?: string;
  curator?: string;
  allocators: string[];
  sentinels?: string[];
  chainId: SupportedNetworks;
  vaultAsset?: Address;
  existingCaps?: VaultV2Cap[];
  onSetAllocator: (allocator: Address, isAllocator: boolean) => Promise<boolean>;
  onUpdateCaps: (caps: VaultV2Cap[]) => Promise<boolean>;
  isUpdatingAllocator: boolean;
  isUpdatingCaps: boolean;
};

export function VaultSettingsModal({
  isOpen,
  onClose,
  initialTab = 'general',
  isOwner,
  onUpdateMetadata,
  updatingMetadata,
  defaultName,
  defaultSymbol,
  currentName,
  currentSymbol,
  owner,
  curator,
  allocators,
  sentinels = [],
  chainId,
  vaultAsset,
  existingCaps = [],
  onSetAllocator,
  onUpdateCaps,
  isUpdatingAllocator,
  isUpdatingCaps,
}: VaultSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [mounted, setMounted] = useState(false);
  const wasOpenRef = useRef(false);

  // Reset to initial tab when modal opens
  useEffect(() => {
    const wasOpen = wasOpenRef.current;

    if (isOpen && !wasOpen) {
      setActiveTab(initialTab);
    }

    wasOpenRef.current = isOpen;
  }, [initialTab, isOpen]);

  // Handle mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle ESC key
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

  const handleTabChange = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
  }, []);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralTab
            isOwner={isOwner}
            defaultName={defaultName}
            defaultSymbol={defaultSymbol}
            currentName={currentName}
            currentSymbol={currentSymbol}
            onUpdateMetadata={onUpdateMetadata}
            updatingMetadata={updatingMetadata}
            chainId={chainId}
          />
        );
      case 'agents':
        return (
          <AgentsTab
            isOwner={isOwner}
            owner={owner}
            curator={curator}
            allocators={allocators}
            sentinels={sentinels}
            onSetAllocator={onSetAllocator}
            isUpdatingAllocator={isUpdatingAllocator}
            chainId={chainId}
          />
        );
      case 'allocations':
        return (
          <AllocationsTab
            isOwner={isOwner}
            chainId={chainId}
            vaultAsset={vaultAsset}
            existingCaps={existingCaps}
            onUpdateCaps={onUpdateCaps}
            isUpdatingCaps={isUpdatingCaps}
          />
        );
      default:
        return null;
    }
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-4 font-zen"
      onMouseDown={onClose}
    >
      <div
        className="relative flex w-full max-w-6xl min-h-[560px] overflow-hidden rounded-2xl border border-divider/20 bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-1 flex-col bg-background/95">
          {/* Header */}
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

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
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

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-6">
              <div className="min-h-[360px] space-y-6">{renderActiveTab()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
