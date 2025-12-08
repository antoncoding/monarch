import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Input } from '@heroui/react';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import type { GeneralTabProps } from './types';

export function GeneralTab({
  isOwner,
  defaultName,
  defaultSymbol,
  currentName,
  currentSymbol,
  onUpdateMetadata,
  updatingMetadata,
  chainId,
}: GeneralTabProps) {
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

    const success = await onUpdateMetadata({
      name: trimmedName !== previousName ? trimmedName || undefined : undefined,
      symbol: trimmedSymbol !== previousSymbol ? trimmedSymbol || undefined : undefined,
    });

    if (success) {
      setMetadataError(null);
    }
  }, [metadataChanged, onUpdateMetadata, previousName, previousSymbol, trimmedName, trimmedSymbol, needSwitchChain, switchToNetwork]);

  return (
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
              inputWrapper: 'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
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
              inputWrapper: 'bg-hovered/60 border-transparent shadow-none focus-within:border-transparent focus-within:bg-hovered/80',
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
          ) : needSwitchChain ? (
            'Switch Network'
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </div>
  );
}
