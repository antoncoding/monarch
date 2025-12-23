import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { GearIcon } from '@radix-ui/react-icons';
import { BsQuestionCircle } from 'react-icons/bs';
import { GrStatusGood } from 'react-icons/gr';
import type { Address } from 'viem';
import { AgentIcon } from '@/components/shared/agent-icon';
import { Spinner } from '@/components/ui/spinner';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { findAgent } from '@/utils/monarch-agent';

type VaultAllocatorCardProps = {
  allocators: string[];
  onManageAgents: () => void;
  needsSetup?: boolean;
  isOwner?: boolean;
  isLoading?: boolean;
};

export function VaultAllocatorCard({
  allocators,
  onManageAgents,
  needsSetup = false,
  isOwner = false,
  isLoading = false,
}: VaultAllocatorCardProps) {
  const hasAllocators = allocators.length > 0;
  const cardStyle = 'bg-surface rounded shadow-sm';

  return (
    <Card className={cardStyle}>
      <CardHeader className="flex items-center justify-between pb-2">
        <span className="text-xs uppercase tracking-wide text-secondary">Allocators</span>
        {isOwner && !needsSetup && (
          <GearIcon
            className="h-4 w-4 cursor-pointer text-secondary hover:text-primary"
            onClick={onManageAgents}
          />
        )}
      </CardHeader>
      <CardBody className="flex items-center justify-center py-3">
        {isLoading ? (
          <Spinner size={16} />
        ) : needsSetup ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-xs text-secondary">Setup required</span>
            </div>
          </div>
        ) : hasAllocators ? (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {allocators
              .map((allocatorAddress) => findAgent(allocatorAddress))
              .filter((agent): agent is NonNullable<typeof agent> => agent !== undefined)
              .map((agent) => (
                <AgentIcon
                  key={agent.address}
                  address={agent.address as Address}
                  width={20}
                  height={20}
                />
              ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-secondary">No allocators configured</span>
            <Tooltip
              content={
                <TooltipContent
                  icon={<GrStatusGood className="h-4 w-4" />}
                  title="Allocators"
                  detail="Add an allocator agent to enable automated vault rebalancing and allocation management."
                />
              }
            >
              <BsQuestionCircle />
            </Tooltip>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
