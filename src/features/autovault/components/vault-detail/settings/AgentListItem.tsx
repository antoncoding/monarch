import type { Address } from 'viem';
import { Avatar } from '@/components/Avatar/Avatar';
import { AgentIcon } from '@/components/shared/agent-icon';
import { AccountIdentity } from '@/components/shared/account-identity';
import { findAgent } from '@/utils/monarch-agent';
import { SupportedNetworks } from '@/utils/networks';

type AgentListItemProps = {
  address: Address;
  chainId?: number;
  ownerAddress?: Address;
};

export function AgentListItem({ address, chainId, ownerAddress }: AgentListItemProps) {
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
        chainId={chainId ?? SupportedNetworks.Mainnet}
        variant="badge"
      />
    </div>
  );
}
