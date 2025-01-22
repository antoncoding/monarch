import React from 'react';
import Image from 'next/image';
import { findToken } from '@/utils/tokens';

type TokenIconProps = {
  address: string;
  chainId: number;
  width: number;
  height: number;
  opacity?: number;
};

export function TokenIcon({ address, chainId, width, height, opacity }: TokenIconProps) {
  const token = findToken(address, chainId);

  if (!token?.img) {
    return <div className="rounded-full bg-gray-300" style={{ width, height }} />;
  }

  return (
    <Image
      className="rounded-full"
      src={token.img}
      alt={token.symbol || 'Token'}
      width={width}
      height={height}
      style={{ opacity }}
    />
  );
}
