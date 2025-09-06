import React, { useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { useTokens } from '@/components/providers/TokenProvider';
import { TooltipContent } from './TooltipContent';
import { getTruncatedAssetName } from '@/utils/oracle';
type TokenIconProps = {
  address: string;
  chainId: number;
  width: number;
  height: number;
  opacity?: number;
  symbol?: string;
  truncated?: boolean
};

export function TokenIcon({ address, chainId, width, height, opacity, truncated }: TokenIconProps) {
  const { findToken } = useTokens();

  const token = useMemo(() => findToken(address, chainId), [address, chainId, findToken]);

  // If we have a token with an image, use that
  if (token?.img) {
    const img = (
      <Image
        className="rounded-full"
        src={token.img}
        alt={token.symbol}
        width={width}
        height={height}
      />
    );

    const detail = token.isFactoryToken
      ? `This token is auto-detected from ${token.protocol?.name} `
      : `This token is whitelisted by Monarch`;

    return (
      <Tooltip content={<TooltipContent title={truncated ? getTruncatedAssetName(token.symbol) : token.symbol} detail={detail} icon={img} />}>
        <Image
          className="rounded-full"
          src={token.img}
          alt={token.symbol}
          width={width}
          height={height}
          style={{ opacity }}
        />
      </Tooltip>
    );
  }

  // Fallback to placeholder
  return <div className="rounded-full bg-gray-300 dark:bg-gray-700" style={{ width, height }} />;
}
