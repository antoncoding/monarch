'use client';

import { useCallback } from 'react';
import { FiDownload, FiRepeat } from 'react-icons/fi';
import { LuArrowRightLeft } from 'react-icons/lu';
import { BsArrowDownCircle, BsArrowUpCircle } from 'react-icons/bs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useTransactionProcessStore } from '@/stores/useTransactionProcessStore';

const TX_TYPE_ICONS: Record<string, React.ReactNode> = {
  supply: <BsArrowUpCircle className="h-4 w-4" />,
  borrow: <BsArrowDownCircle className="h-4 w-4" />,
  repay: <FiRepeat className="h-4 w-4" />,
  vaultDeposit: <FiDownload className="h-4 w-4" />,
  deposit: <FiDownload className="h-4 w-4" />,
  wrap: <LuArrowRightLeft className="h-4 w-4" />,
  rebalance: <LuArrowRightLeft className="h-4 w-4" />,
};

const TX_TYPE_LABELS: Record<string, string> = {
  supply: 'Supply',
  borrow: 'Borrow',
  repay: 'Repay',
  vaultDeposit: 'Deposit',
  deposit: 'Deposit',
  wrap: 'Wrap',
  rebalance: 'Rebalance',
};

/**
 * Header indicator showing active background transactions.
 * Displays a pulsing badge when transactions are in progress.
 * Clicking reveals a dropdown with transaction details and option to reopen modal.
 */
export function TransactionIndicator() {
  const backgroundTransactions = useTransactionProcessStore((s) => s.getBackgroundTransactions());
  const setModalVisible = useTransactionProcessStore((s) => s.setModalVisible);

  const handleViewTransaction = useCallback(
    (txId: string) => {
      setModalVisible(txId, true);
    },
    [setModalVisible],
  );

  // Don't render if no background transactions
  if (backgroundTransactions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex items-center justify-center rounded-sm p-1.5 transition-colors hover:bg-hovered focus:outline-none"
          aria-label={`${backgroundTransactions.length} pending transaction${backgroundTransactions.length > 1 ? 's' : ''}`}
        >
          {/* Pulsing indicator */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>

          {/* Count badge */}
          {backgroundTransactions.length > 1 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-white">
              {backgroundTransactions.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-[220px]"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-secondary">Pending Transactions</div>

        {backgroundTransactions.map((tx) => {
          const currentStepIndex = tx.steps.findIndex((s) => s.id === tx.currentStep);
          const currentStepLabel = tx.steps[currentStepIndex]?.title ?? tx.currentStep;

          return (
            <DropdownMenuItem
              key={tx.id}
              onClick={() => handleViewTransaction(tx.id)}
              startContent={TX_TYPE_ICONS[tx.type] ?? TX_TYPE_ICONS.supply}
            >
              <div className="flex flex-1 flex-col">
                <span className="font-medium">
                  {TX_TYPE_LABELS[tx.type] ?? 'Transaction'}
                  {tx.metadata?.tokenSymbol && ` ${tx.metadata.tokenSymbol}`}
                </span>
                <span className="text-xs text-secondary">{currentStepLabel}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
