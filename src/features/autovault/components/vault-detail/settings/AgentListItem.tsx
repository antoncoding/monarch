import type { Address } from 'viem';
import { AgentIcon } from '@/components/shared/agent-icon';
import { AccountIdentity } from '@/components/shared/account-identity';
import { findAgent } from '@/utils/monarch-agent';

type AgentListItemProps = {
  address: Address;
};

export function AgentListItem({ address }: AgentListItemProps) {
  const agent = findAgent(address);

  return (
    <div className="flex items-center gap-2">
      <AgentIcon
        address={address}
        width={24}
        height={24}
      />
      {agent && <span className="text-sm font-medium">{agent.name}</span>}
      <AccountIdentity
        address={address}
        variant="badge"
      />
    </div>
  );
}
