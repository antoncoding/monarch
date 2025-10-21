import { HiQuestionMarkCircle } from 'react-icons/hi';
import { Address } from 'viem';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import { findAgent } from '@/utils/monarch-agent';
import Image from 'next/image';

type AgentListItemProps = {
  address: Address;
};

export function AgentListItem({ address }: AgentListItemProps) {
  const agent = findAgent(address);

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-hovered/50">
        {agent ? (
          <Image
            src={agent.image}
            alt={agent.name}
            width={24}
            height={24}
            className="rounded-full"
          />
        ) : (
          <HiQuestionMarkCircle className="h-6 w-6 text-secondary" />
        )}
      </div>
      {agent && <span className="text-sm font-medium">{agent.name}</span>}
      <AddressDisplay address={address} size="sm" />
    </div>
  );
}
