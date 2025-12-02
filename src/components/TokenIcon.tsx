import React, { useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { FiExternalLink } from 'react-icons/fi';
import { useTokens } from '@/components/providers/TokenProvider';
import { TooltipContent } from '@/components/TooltipContent';
import { getExplorerUrl } from '@/utils/networks';

type TokenIconProps = {
  address: string;
  chainId: number;
  width: number;
  height: number;
  opacity?: number;
  symbol?: string;
  customTooltipTitle?: string;
  customTooltipDetail?: string;
  showExplorerLink?: boolean;
  showTokenSource?: boolean;
  disableTooltip?: boolean;
};

export function TokenIcon({
  address,
  chainId,
  width,
  height,
  opacity,
  customTooltipTitle,
  customTooltipDetail,
  showExplorerLink = false,
  showTokenSource = true,
  disableTooltip = false,
}: TokenIconProps) {
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
        style={{ opacity }}
        unoptimized
      />
    );

    const title = customTooltipTitle ?? token.symbol;

    const tokenSource = token.isFactoryToken
      ? `This token is auto-detected from ${token.protocol?.name}`
      : `This token is recognized by Monarch`;

    const explorerUrl = showExplorerLink ? `${getExplorerUrl(chainId)}/address/${address}` : null;

    // Build detail/secondaryDetail based on what's provided
    const detail = customTooltipDetail || (showTokenSource ? tokenSource : undefined);
    const secondaryDetail = customTooltipDetail && showTokenSource ? tokenSource : undefined;

    if (disableTooltip) {
      return img;
    }

    return (
      <Tooltip
        classNames={{
          base: 'p-0 m-0 bg-transparent shadow-sm border-none',
          content: 'p-0 m-0 bg-transparent shadow-sm border-none',
        }}
        content={
          <TooltipContent
            icon={img}
            title={title}
            detail={detail}
            secondaryDetail={secondaryDetail}
            actionIcon={explorerUrl ? <FiExternalLink className="h-4 w-4" /> : undefined}
            actionHref={explorerUrl ?? undefined}
            onActionClick={(e) => e.stopPropagation()}
          />
        }
      >
        {img}
      </Tooltip>
    );
  }

  // Fallback to placeholder
  return <div className="rounded-full bg-gray-300 dark:bg-gray-700" style={{ width, height }} />;
}
