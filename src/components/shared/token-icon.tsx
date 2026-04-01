import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { TooltipContent } from '@/components/shared/tooltip-content';
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
  const { findToken } = useTokensQuery();

  const token = useMemo(() => findToken(address, chainId), [address, chainId, findToken]);

  // If we have a token with an image, use that
  if (token?.img) {
    const tokenImg = token.img;
    const renderImage = () => (
      <Image
        className="rounded-full"
        src={tokenImg}
        alt={token.symbol}
        width={width}
        height={height}
        style={{ opacity }}
        unoptimized
      />
    );
    const triggerImage = renderImage();

    const title = customTooltipTitle ?? token.symbol;

    const tokenSource = token.isFactoryToken
      ? `This token is auto-detected from ${token.protocol?.name}`
      : 'This token is recognized by Monarch';

    const explorerUrl = showExplorerLink ? `${getExplorerUrl(chainId)}/address/${address}` : null;

    // Build detail/secondaryDetail based on what's provided
    const detail = customTooltipDetail || (showTokenSource ? tokenSource : undefined);
    const secondaryDetail = customTooltipDetail && showTokenSource ? tokenSource : undefined;

    if (disableTooltip) {
      return triggerImage;
    }

    return (
      <Tooltip
        content={
          <TooltipContent
            // Render a fresh image instance for tooltip content.
            // Reusing one Next Image element in both positions can loop through merged refs.
            icon={renderImage()}
            title={title}
            detail={detail}
            secondaryDetail={secondaryDetail}
            actionIcon={explorerUrl ? <ExternalLinkIcon className="h-4 w-4" /> : undefined}
            actionHref={explorerUrl ?? undefined}
            onActionClick={(e) => e.stopPropagation()}
          />
        }
      >
        {triggerImage}
      </Tooltip>
    );
  }

  // Fallback to placeholder
  return (
    <div
      className="rounded-full bg-gray-300 dark:bg-gray-700"
      style={{ width, height }}
    />
  );
}
