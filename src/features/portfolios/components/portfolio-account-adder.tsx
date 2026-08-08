'use client';

import { useState } from 'react';
import { PlusIcon } from '@radix-ui/react-icons';
import { getAddress, isAddress, type Address } from 'viem';
import { useConnection } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PortfolioAccountAdder({
  accounts,
  onAdd,
  disabled = false,
}: {
  accounts: Address[];
  onAdd: (account: Address) => void;
  disabled?: boolean;
}) {
  const { address } = useConnection();
  const [inputAddress, setInputAddress] = useState('');
  const [error, setError] = useState('');
  const connectedAccountIsSelected = address !== undefined && accounts.some((account) => account.toLowerCase() === address.toLowerCase());

  const addAddress = () => {
    const value = inputAddress.trim();
    if (!isAddress(value, { strict: false })) {
      setError('Enter a valid Ethereum address.');
      return;
    }

    const account = getAddress(value);
    if (accounts.some((entry) => entry.toLowerCase() === account.toLowerCase())) {
      setError('This account is already included.');
      return;
    }

    onAdd(account);
    setInputAddress('');
    setError('');
  };

  return (
    <div className="space-y-2">
      {address && !connectedAccountIsSelected && (
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-hovered disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onAdd(address)}
          disabled={disabled}
        >
          <Avatar
            address={address}
            size={20}
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-primary">Connected wallet</span>
            <span className="block font-monospace text-xs text-secondary">
              {address.slice(0, 8)}…{address.slice(-6)}
            </span>
          </span>
          <PlusIcon className="ml-auto h-4 w-4 text-secondary" />
        </button>
      )}

      <div className="flex items-start gap-2">
        <Input
          value={inputAddress}
          onValueChange={(value) => {
            setInputAddress(value);
            if (error) setError('');
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            addAddress();
          }}
          placeholder="Add address (0x…)"
          variant="filled"
          size="md"
          disabled={disabled}
          isInvalid={Boolean(error)}
          errorMessage={error}
        />
        <Button
          variant="surface"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={addAddress}
          disabled={disabled || !inputAddress.trim()}
          aria-label="Add address"
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
