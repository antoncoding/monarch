'use client';

import clsx from 'clsx';
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

  // Use font-zen for ENS names, font-monospace (smaller) for addresses
  const fontClass = ensName ? 'font-zen' : 'font-monospace text-[0.9em]';

  return <span className={clsx(fontClass, className)}>{ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`}</span>;
}
