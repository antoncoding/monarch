'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import type { SupportedNetworks } from '@/utils/networks';

type EditMetadataProps = {
  chainId: SupportedNetworks;
  isOwner: boolean;
  isUpdating: boolean;
  defaultName: string;
  defaultSymbol: string;
  currentName: string;
  currentSymbol: string;
  onUpdate: (name?: string, symbol?: string) => Promise<boolean>;
  onCancel: () => void;
};

export function EditMetadata({
  chainId,
  isOwner,
  isUpdating,
  defaultName,
  defaultSymbol,
  currentName,
  currentSymbol,
  onUpdate,
  onCancel,
}: EditMetadataProps) {
  const nameInputId = useId();
  const symbolInputId = useId();

  const previousName = useMemo(() => currentName.trim(), [currentName]);
  const previousSymbol = useMemo(() => currentSymbol.trim(), [currentSymbol]);

  const [nameInput, setNameInput] = useState(previousName || defaultName);
  const [symbolInput, setSymbolInput] = useState(previousSymbol || defaultSymbol);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });

  // Reset inputs when current values change
  useEffect(() => {
    setNameInput(previousName || defaultName);
    setSymbolInput(previousSymbol || defaultSymbol);
  }, [previousName, previousSymbol, defaultName, defaultSymbol]);

  const trimmedName = nameInput.trim();
  const trimmedSymbol = symbolInput.trim();

  const metadataChanged = useMemo(() => {
    const hasNewName = trimmedName !== previousName;
    const hasNewSymbol = trimmedSymbol !== previousSymbol;
    return hasNewName || hasNewSymbol;
  }, [previousName, previousSymbol, trimmedName, trimmedSymbol]);

  // Clear error when inputs change
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

    // Switch network if needed
    if (needSwitchChain) {
      switchToNetwork();
      return;
    }

    const success = await onUpdate(
      trimmedName !== previousName ? (trimmedName ?? undefined) : undefined,
      trimmedSymbol !== previousSymbol ? (trimmedSymbol ?? undefined) : undefined,
    );

    if (success) {
      setMetadataError(null);
    }
  }, [metadataChanged, onUpdate, previousName, previousSymbol, trimmedName, trimmedSymbol, needSwitchChain, switchToNetwork]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase text-secondary">Edit Metadata</p>
          <p className="text-xs text-secondary">Update the name and symbol of the vault.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            className="text-[11px] uppercase text-secondary"
            htmlFor={nameInputId}
          >
            Vault name
          </label>
          <Input
            size="sm"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            placeholder={defaultName}
            disabled={!isOwner}
            id={nameInputId}
            classNames={{
              input: 'text-sm',
              inputWrapper: 'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
            }}
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-[11px] uppercase text-secondary"
            htmlFor={symbolInputId}
          >
            Vault symbol
          </label>
          <Input
            size="sm"
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder={defaultSymbol}
            maxLength={16}
            disabled={!isOwner}
            id={symbolInputId}
            classNames={{
              input: 'text-sm',
              inputWrapper: 'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
            }}
          />
        </div>

        {metadataError && <p className="text-xs text-danger">{metadataError}</p>}

        <div className="flex items-center justify-between border-t border-divider/30 pt-4">
          <div />
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!metadataChanged || isUpdating || !isOwner}
              onClick={() => void handleMetadataSubmit()}
            >
              {isUpdating ? (
                <span className="flex items-center gap-2">
                  <Spinner size={12} /> Saving...
                </span>
              ) : needSwitchChain ? (
                'Switch Network'
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
