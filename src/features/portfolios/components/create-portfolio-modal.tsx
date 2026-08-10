'use client';

import { useMemo, useState } from 'react';
import { RiStackLine } from 'react-icons/ri';
import type { Address } from 'viem';
import { Avatar } from '@/components/Avatar/Avatar';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MAX_PORTFOLIO_ACCOUNTS, useLocalPortfolios } from '@/stores/useLocalPortfolios';
import { PortfolioAccountAdder } from './portfolio-account-adder';
import { usePortfolioAddressOptions } from '../hooks/use-portfolio-address-options';

type CreatePortfolioModalProps = {
  initialAccounts?: Address[];
  onCreated?: (portfolioSlug: string) => void;
  onOpenChange: (open: boolean) => void;
};

export function CreatePortfolioModal({ initialAccounts = [], onCreated, onOpenChange }: CreatePortfolioModalProps) {
  const createPortfolio = useLocalPortfolios((state) => state.createPortfolio);
  const [name, setName] = useState('');
  const [accounts, setAccounts] = useState<Address[]>(initialAccounts);
  const [addedAccounts, setAddedAccounts] = useState<Address[]>([]);
  const accountSeeds = useMemo(() => [...initialAccounts, ...addedAccounts], [addedAccounts, initialAccounts]);
  const accountOptions = usePortfolioAddressOptions(accountSeeds);

  const addAccount = (account: Address) => {
    if (accounts.length >= MAX_PORTFOLIO_ACCOUNTS) return;
    if (accounts.some((entry) => entry.toLowerCase() === account.toLowerCase())) return;
    setAccounts((current) => [...current, account]);
    setAddedAccounts((current) =>
      current.some((entry) => entry.toLowerCase() === account.toLowerCase()) ? current : [...current, account],
    );
  };

  const toggleAccount = (account: Address) => {
    setAccounts((current) => {
      const key = account.toLowerCase();
      if (current.some((entry) => entry.toLowerCase() === key)) {
        return current.filter((entry) => entry.toLowerCase() !== key);
      }
      if (current.length >= MAX_PORTFOLIO_ACCOUNTS) return current;
      return [...current, account];
    });
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const portfolio = createPortfolio(name, accounts);
    onOpenChange(false);
    onCreated?.(portfolio.slug);
  };

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="md"
      backdrop="opaque"
    >
      <ModalHeader
        variant="compact"
        title="Create portfolio"
        description="Name this local portfolio and choose accounts you view frequently."
        mainIcon={<RiStackLine />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody variant="compact">
        <Input
          value={name}
          onValueChange={setName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleCreate();
          }}
          placeholder="Portfolio name"
          variant="filled"
          size="md"
          autoFocus
        />

        <div>
          <div className="mb-2 text-xs font-medium text-secondary">Add accounts</div>
          <PortfolioAccountAdder
            accounts={accounts}
            onAdd={addAccount}
            disabled={accounts.length >= MAX_PORTFOLIO_ACCOUNTS}
          />
        </div>

        {accountOptions.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-secondary">Available accounts</div>
            <div className="space-y-1">
              {accountOptions.map((account) => {
                const checked = accounts.some((entry) => entry.toLowerCase() === account.toLowerCase());
                const checkboxId = `portfolio-account-${account}`;
                return (
                  <label
                    key={account}
                    htmlFor={checkboxId}
                    className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 transition-colors hover:bg-hovered"
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={() => toggleAccount(account)}
                      disabled={!checked && accounts.length >= MAX_PORTFOLIO_ACCOUNTS}
                      aria-label={`Include ${account}`}
                    />
                    <Avatar
                      address={account}
                      size={20}
                    />
                    <span className="font-monospace text-xs text-secondary">
                      {account.slice(0, 8)}…{account.slice(-6)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          variant="ghost"
          size="md"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleCreate}
          disabled={!name.trim()}
        >
          Create portfolio
        </Button>
      </ModalFooter>
    </Modal>
  );
}
