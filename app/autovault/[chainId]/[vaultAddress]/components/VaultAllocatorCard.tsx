import { Card, CardBody, CardHeader, Tooltip } from '@heroui/react';
import { GearIcon } from '@radix-ui/react-icons';
import { GrStatusGood } from 'react-icons/gr';
import { Address } from 'viem';
import { Spinner } from '@/components/common/Spinner';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { TooltipContent } from '@/components/TooltipContent';
import { SupportedNetworks } from '@/utils/networks';

type VaultAllocatorCardProps = {
  allocators: string[];
  chainId: SupportedNetworks;
  onManageAgents: () => void;
  needsSetup?: boolean;
  isOwner?: boolean;
  isLoading?: boolean;
};

export function VaultAllocatorCard({
  allocators,
  chainId,
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
          <div className="space-y-3">
            {allocators.map((allocatorAddress) => (
              <div key={allocatorAddress} className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full bg-green-500"
                      title="Active"
                    />
                    <AddressDisplay
                      address={allocatorAddress as Address}
                      chainId={chainId}
                      size="sm"
                      showExplorerLink
                    />
                  </div>
                  <p className="text-xs text-secondary">Authorized for rebalancing</p>
                </div>
              </div>
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
                <span className="text-xs text-secondary underline">What's this?</span>
              </Tooltip>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
