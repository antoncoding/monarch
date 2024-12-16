'use client';

import { useEnsName } from 'wagmi';

type NameProps = {
  address: `0x${string}`;
  className?: string;
};

export function Name({ address, className = '' }: NameProps) {
  const { data: ensName, isLoading } = useEnsName({
    address,
    chainId: 1,
  });

  if (isLoading) {
    return <span className={className}>...</span>;
  }

  return (
    <span className={className}>{ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`}</span>
  );
}
