import type { Address } from 'viem';
import { Avatar } from '@/components/Avatar/Avatar';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableCell } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { AccountActionsPopover } from '@/components/shared/account-actions-popover';

export function PositionAccountCell({ account, chainId }: { account: Address; chainId?: number }) {
  return (
    <TableCell
      data-label="Account"
      className="w-16"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <AccountActionsPopover
        address={account}
        chainId={chainId}
        buttonTrigger
      >
        <Tooltip
          content={
            <TooltipContent
              title="Position owner"
              detail={`${account.slice(0, 6)}…${account.slice(-4)}`}
            />
          }
        >
          <span className="flex justify-center">
            <Avatar
              address={account}
              size={20}
            />
          </span>
        </Tooltip>
      </AccountActionsPopover>
    </TableCell>
  );
}
