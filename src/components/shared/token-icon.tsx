import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { getPharosAssetUrl, PharosAssetRiskBadge } from '@/components/shared/pharos-asset-risk-badge';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useAssetRiskEntry } from '@/hooks/queries/useAssetRiskQuery';
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
  const { assetRisk } = useAssetRiskEntry(address, chainId, !disableTooltip && Boolean(token?.img));

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
      : 'This token is recognized by Monarch';

    const explorerUrl = showExplorerLink ? `${getExplorerUrl(chainId)}/address/${address}` : null;
    const pharosUrl = getPharosAssetUrl(assetRisk);
    const action = (
      <div className="flex items-center gap-1.5">
        {pharosUrl && assetRisk && (
          <PharosAssetRiskBadge
            assetRisk={assetRisk}
            href={pharosUrl}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-secondary hover:text-primary transition-colors"
          >
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
        )}
      </div>
    );

    // Build detail/secondaryDetail based on what's provided
    const detail = customTooltipDetail || (showTokenSource ? tokenSource : undefined);
    const secondaryDetail = customTooltipDetail && showTokenSource ? tokenSource : undefined;

    if (disableTooltip) {
      return img;
    }

    return (
      <Tooltip
        content={
          <TooltipContent
            icon={img}
            title={title}
            detail={detail}
            secondaryDetail={secondaryDetail}
            action={pharosUrl || explorerUrl ? action : undefined}
          />
        }
      >
        {img}
      </Tooltip>
    );
  }

  return (
    <div
      className="rounded-full bg-gray-300 dark:bg-gray-700"
      style={{ width, height }}
    />
  );
}
