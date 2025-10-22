import { Address } from 'viem';
import { AgentIcon } from '@/components/AgentIcon';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { findAgent } from '@/utils/monarch-agent';

type AgentListItemProps = {
  address: Address;
};

export function AgentListItem({ address }: AgentListItemProps) {
  const agent = findAgent(address);

  return (
    <div className="flex items-center gap-2">
      <AgentIcon address={address} width={24} height={24} />
      {agent && <span className="text-sm font-medium">{agent.name}</span>}
      <AddressDisplay address={address} size="sm" />
    </div>
  );
}
