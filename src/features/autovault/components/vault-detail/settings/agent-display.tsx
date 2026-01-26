import type { ReactNode } from 'react';
import Image from 'next/image';
import { findAgent } from '@/utils/monarch-agent';

export function getAgentLabel(address: string): string | undefined {
  return findAgent(address)?.name;
}

export function getAgentIcon(address: string): ReactNode | undefined {
  const agent = findAgent(address);
  if (!agent?.image) return undefined;
  return (
    <Image
      src={agent.image}
      alt={agent.name}
      width={14}
      height={14}
      className="rounded-full"
    />
  );
}
