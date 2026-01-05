import type { Address } from 'viem';
import { Avatar } from '@/components/Avatar/Avatar';
import { AgentIcon } from '@/components/shared/agent-icon';
import { AccountIdentity } from '@/components/shared/account-identity';
import { findAgent } from '@/utils/monarch-agent';

type AgentListItemProps = {
  address: Address;
  ownerAddress?: Address;
};

export function AgentListItem({ address, ownerAddress }: AgentListItemProps) {
  const agent = findAgent(address);
  const isOwner = ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase();

  return (
    <div className="flex items-center gap-2">
      {isOwner ? (
        <Avatar
          address={address}
          size={24}
        />
      ) : (
        <AgentIcon
          address={address}
          width={24}
          height={24}
        />
      )}
      {isOwner && <span className="text-sm font-medium">Owner</span>}
      {agent && !isOwner && <span className="text-sm font-medium">{agent.name}</span>}
      <AccountIdentity
        address={address}
        variant="badge"
      />
    </div>
  );
}
