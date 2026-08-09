'use client';

import { useMemo, useState } from 'react';
import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons';
import { RiStackLine } from 'react-icons/ri';
import type { Address } from 'viem';
import { Avatar } from '@/components/Avatar/Avatar';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_PORTFOLIO_ACCOUNTS, useLocalPortfolios } from '@/stores/useLocalPortfolios';
import { PortfolioAccountAdder } from './portfolio-account-adder';
import { usePortfolioAddressOptions } from '../hooks/use-portfolio-address-options';

type EditPortfolioModalProps = {
  portfolioSlug: string;
  onOpenChange: (open: boolean) => void;
};

export function EditPortfolioModal({ portfolioSlug, onOpenChange }: EditPortfolioModalProps) {
  const portfolio = useLocalPortfolios((state) => state.portfolios.find((entry) => entry.slug === portfolioSlug));
  const updatePortfolio = useLocalPortfolios((state) => state.updatePortfolio);
  const initialAccounts = useMemo(() => portfolio?.accounts ?? [], [portfolio?.accounts]);
  const accountOptions = usePortfolioAddressOptions(initialAccounts);
  const [name, setName] = useState(portfolio?.name ?? '');
  const [accounts, setAccounts] = useState<Address[]>(initialAccounts);

  if (!portfolio) return null;

  const selectedKeys = new Set(accounts.map((account) => account.toLowerCase()));
  const availableAccounts = accountOptions.filter((account) => !selectedKeys.has(account.toLowerCase()));

  const removeAccount = (account: Address) => {
    setAccounts((current) => current.filter((entry) => entry.toLowerCase() !== account.toLowerCase()));
  };

  const addAccount = (account: Address) => {
    if (accounts.length >= MAX_PORTFOLIO_ACCOUNTS) return;
    setAccounts((current) => [...current, account]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    updatePortfolio(portfolio.slug, { name, accounts });
    onOpenChange(false);
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
        title="Edit Portfolio"
        description="Rename this portfolio or change which accounts it contains."
        mainIcon={<RiStackLine />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody variant="compact">
        <Input
          value={name}
          onValueChange={setName}
          placeholder="Portfolio name"
          variant="filled"
          size="md"
        />

        <div>
          <div className="mb-2 text-xs font-medium text-secondary">Accounts</div>
          {accounts.length === 0 ? (
            <p className="rounded bg-hovered px-3 py-3 text-sm text-secondary">No accounts selected.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => (
                <div
                  key={account}
                  className="flex items-center gap-2 rounded-sm border border-border bg-background px-2 py-1.5"
                >
                  <Avatar
                    address={account}
                    size={20}
                  />
                  <span className="font-monospace text-xs text-secondary">
                    {account.slice(0, 6)}…{account.slice(-4)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 min-w-0 px-1 text-secondary"
                    aria-label={`Remove ${account}`}
                    onClick={() => removeAccount(account)}
                  >
                    <Cross2Icon />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-secondary">Add accounts</div>
          <PortfolioAccountAdder
            accounts={accounts}
            onAdd={addAccount}
            disabled={accounts.length >= MAX_PORTFOLIO_ACCOUNTS}
          />
        </div>

        {availableAccounts.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-secondary">Previously viewed</div>
            <div className="space-y-1">
              {availableAccounts.map((account) => (
                <button
                  key={account}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors hover:bg-hovered disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => addAccount(account)}
                  disabled={accounts.length >= MAX_PORTFOLIO_ACCOUNTS}
                >
                  <Avatar
                    address={account}
                    size={20}
                  />
                  <span className="font-monospace text-xs text-secondary">
                    {account.slice(0, 8)}…{account.slice(-6)}
                  </span>
                  <PlusIcon className="ml-auto h-4 w-4 text-secondary" />
                </button>
              ))}
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
          onClick={handleSave}
          disabled={!name.trim()}
        >
          Save changes
        </Button>
      </ModalFooter>
    </Modal>
  );
}
