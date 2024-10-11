import React from 'react';
import Image from 'next/image';
import { findToken } from '@/utils/tokens';

type TokenIconProps = {
  address: string;
  chainId: number;
  width: number;
  height: number;
};

export function TokenIcon({ address, chainId, width, height }: TokenIconProps) {
  const token = findToken(address, chainId);

  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
  if (!token || !token.img) {
    return <div className="rounded-full bg-gray-300" style={{ width, height }} />;
  }

  return <Image src={token.img} alt={token.symbol || 'Token'} width={width} height={height} />;
}
