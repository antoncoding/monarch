import type { Address } from 'viem';
import { RiStackLine } from 'react-icons/ri';
import { Avatar } from '@/components/Avatar/Avatar';
import { cn } from '@/utils/components';

export function PortfolioAccountPreview({ accounts, size = 20, className }: { accounts: Address[]; size?: number; className?: string }) {
  if (accounts.length === 0) {
    return (
      <RiStackLine
        aria-hidden
        className={cn('shrink-0 text-secondary', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 -space-x-1', className)}
    >
      {accounts.slice(0, 3).map((account) => (
        <span
          key={account}
          className="rounded-full ring-2 ring-background"
        >
          <Avatar
            address={account}
            size={size}
          />
        </span>
      ))}
    </span>
  );
}
