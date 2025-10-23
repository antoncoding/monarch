import { Card, CardBody, CardHeader, Tooltip } from '@heroui/react';
import { GearIcon } from '@radix-ui/react-icons';
import { BsQuestionCircle } from 'react-icons/bs';
import { GrStatusGood } from 'react-icons/gr';
import { Address } from 'viem';
import { AgentIcon } from '@/components/AgentIcon';
import { Spinner } from '@/components/common/Spinner';
import { TooltipContent } from '@/components/TooltipContent';
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

  if (needsSetup) {
    return null;
  }

  return (
    <Card className={cardStyle}>
      <CardHeader className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-secondary">Allocators</span>
        {isOwner && (
          <GearIcon className="h-4 w-4 cursor-pointer text-secondary hover:text-primary" onClick={onManageAgents} />
        )}
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size={16} />
          </div>
        ) : hasAllocators ? (
          <div className="flex flex-wrap gap-1.5">
            {allocators
              .map((allocatorAddress) => findAgent(allocatorAddress))
              .filter((agent): agent is NonNullable<typeof agent> => agent !== undefined)
              .map((agent) => (
                <AgentIcon
                  key={agent.address}
                  address={agent.address as Address}
                  width={24}
                  height={24}
                />
              ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-sm text-secondary">No allocators configured</span>
              <Tooltip
                classNames={{
                  base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                  content: 'p-0 m-0 bg-transparent shadow-sm border-none',
                }}
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
          </div>
        )}
      </CardBody>
    </Card>
  );
}
