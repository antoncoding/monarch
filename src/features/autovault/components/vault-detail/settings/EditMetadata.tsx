'use client';

import { useCallback, useEffect, useId, useState } from 'react';
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
  onBack: () => void;
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
  onBack,
}: EditMetadataProps) {
  const nameInputId = useId();
  const symbolInputId = useId();

  const previousName = currentName.trim();
  const previousSymbol = currentSymbol.trim();

  const [nameInput, setNameInput] = useState(previousName !== '' ? previousName : defaultName);
  const [symbolInput, setSymbolInput] = useState(previousSymbol !== '' ? previousSymbol : defaultSymbol);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: chainId,
  });

  // Reset inputs when current values change
  useEffect(() => {
    setNameInput(previousName !== '' ? previousName : defaultName);
    setSymbolInput(previousSymbol !== '' ? previousSymbol : defaultSymbol);
  }, [previousName, previousSymbol, defaultName, defaultSymbol]);

  const trimmedName = nameInput.trim();
  const trimmedSymbol = symbolInput.trim();
  const metadataChanged = trimmedName !== previousName || trimmedSymbol !== previousSymbol;

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

    if (needSwitchChain) {
      switchToNetwork();
      return;
    }

    await onUpdate(trimmedName !== previousName ? trimmedName : undefined, trimmedSymbol !== previousSymbol ? trimmedSymbol : undefined);
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

        <div className="flex items-center justify-end gap-2 border-t border-divider/30 pt-4">
          <Button
            variant="default"
            size="sm"
            onClick={onBack}
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
  );
}
