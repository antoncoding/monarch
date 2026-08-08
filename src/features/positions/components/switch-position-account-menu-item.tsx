'use client';

import { LuUserRoundCheck } from 'react-icons/lu';
import type { Address } from 'viem';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useRequirePositionAccount } from '@/hooks/useRequirePositionAccount';

export function SwitchPositionAccountMenuItem({ account }: { account: Address }) {
  const { isExpectedAccount, requestExpectedAccount } = useRequirePositionAccount(account);
  if (isExpectedAccount) return null;

  return (
    <DropdownMenuItem
      onClick={() => void requestExpectedAccount()}
      startContent={<LuUserRoundCheck className="h-4 w-4" />}
    >
      Switch to this account
    </DropdownMenuItem>
  );
}
