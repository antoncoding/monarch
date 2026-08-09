'use client';

import { LuUserRoundCheck } from 'react-icons/lu';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function SwitchPositionAccountMenuItem() {
  return (
    <DropdownMenuItem
      disabled
      startContent={<LuUserRoundCheck className="h-4 w-4" />}
    >
      Switch to this account
    </DropdownMenuItem>
  );
}
