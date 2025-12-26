import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useConnection } from 'wagmi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import type { GeneralTabProps } from './types';

export function GeneralTab({ vaultAddress, chainId }: GeneralTabProps) {
  const { address: connectedAddress } = useConnection();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData } = useVaultV2Data({ vaultAddress, chainId });
  const { isOwner, name, symbol, updateNameAndSymbol, isUpdatingMetadata } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
  });

  const defaultName = vaultData?.displayName ?? '';
  const defaultSymbol = vaultData?.displaySymbol ?? '';
  const currentName = name;
  const currentSymbol = symbol;
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

    const success = await updateNameAndSymbol({
      name: trimmedName !== previousName ? trimmedName || undefined : undefined,
      symbol: trimmedSymbol !== previousSymbol ? trimmedSymbol || undefined : undefined,
    });

    if (success) {
      setMetadataError(null);
    }
  }, [metadataChanged, updateNameAndSymbol, previousName, previousSymbol, trimmedName, trimmedSymbol, needSwitchChain, switchToNetwork]);

  return (
    <div className="space-y-6">
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

        <Button
          className="ml-auto"
          variant="surface"
          size="sm"
          disabled={!metadataChanged || isUpdatingMetadata || !isOwner}
          onClick={() => void handleMetadataSubmit()}
        >
          {isUpdatingMetadata ? (
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
