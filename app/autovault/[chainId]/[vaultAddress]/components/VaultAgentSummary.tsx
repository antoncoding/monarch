import { Tooltip } from '@heroui/react';
import clsx from 'clsx';
import { GrStatusGood } from 'react-icons/gr';
import { Button } from '@/components/common';
import { TooltipContent } from '@/components/TooltipContent';

type VaultAgentSummaryProps = {
  isActive: boolean;
  activeAgents: number;
  description: string;
  onManageAgents: () => void;
  onManageAllocations?: () => void;
  roleStatusText: string;
};

export function VaultAgentSummary({
  isActive,
  activeAgents,
  description,
  onManageAgents,
  onManageAllocations,
  roleStatusText,
}: VaultAgentSummaryProps) {
  return (
    <div className="bg-surface flex flex-col gap-4 rounded p-4 shadow-sm font-zen sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'h-2.5 w-2.5 rounded-full',
              isActive ? 'bg-green-500' : 'bg-yellow-500',
            )}
          />
          <span className="text-sm font-medium text-secondary">
            {isActive ? 'Automation agents executing strategy' : 'Automation paused'}
          </span>
          <Tooltip
            classNames={{
              base: 'p-0 m-0 bg-transparent shadow-sm border-none',
              content: 'p-0 m-0 bg-transparent shadow-sm border-none',
            }}
            content={
              <TooltipContent
                icon={<GrStatusGood className="h-4 w-4" />}
                title="Automation status"
                detail={description}
              />
            }
          >
            <span className="text-xs text-secondary underline">Details</span>
          </Tooltip>
        </div>
        <p className="text-sm text-secondary">
          {activeAgents > 0
            ? `${activeAgents} allocator${activeAgents > 1 ? 's' : ''} authorized to rebalance.`
            : 'No allocators authorized yet—add one to enable automation.'}
        </p>
        <p className="text-xs uppercase text-secondary">{roleStatusText}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="subtle" size="sm" onPress={onManageAgents}>
          Manage agents
        </Button>
        {onManageAllocations && (
          <Button variant="subtle" size="sm" onPress={onManageAllocations}>
            Allocation caps
          </Button>
        )}
      </div>
    </div>
  );
}
