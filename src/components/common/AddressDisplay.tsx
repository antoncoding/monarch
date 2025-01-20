'use client';

import { useMemo } from 'react';
import { FaCircle } from 'react-icons/fa';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { Name } from '@/components/common/Name';

type AddressDisplayProps = {
  address: Address;
};

export function AddressDisplay({ address }: AddressDisplayProps) {
  const { address: connectedAddress, isConnected } = useAccount();

  const isOwner = useMemo(() => {
    return address === connectedAddress;
  }, [address, connectedAddress]);

  return (
    <div className="flex items-start gap-4">
      <div className="relative overflow-hidden rounded">
        <Avatar address={address} size={36} rounded={false} />
        {isOwner && isConnected && (
          <div className="absolute bottom-0 right-0 h-4 w-full bg-gradient-to-r from-green-500/20 to-green-500/40 backdrop-blur-sm">
            <div className="absolute bottom-1 right-1">
              <FaCircle size={8} className="text-green-500" />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <Name
          address={address as `0x${string}`}
          className={`rounded p-2 font-monospace text-sm ${
            isOwner && isConnected ? 'bg-green-500/10 text-green-500' : 'bg-hovered'
          }`}
        />
      </div>
    </div>
  );
}
