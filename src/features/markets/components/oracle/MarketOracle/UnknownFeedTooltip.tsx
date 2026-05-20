import Image from 'next/image';
import Link from 'next/link';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import { formatKlerosAddressTagLabel, type KlerosAddressTag } from '@/data-sources/kleros/address-tags';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import type { FeedFreshnessStatus } from '@/utils/oracle';
import { FeedTypeSection } from './FeedTypeSection';
import { FeedFreshnessSection } from './FeedFreshnessSection';

type UnknownFeedTooltipProps = {
  feed: EnrichedFeed;
  chainId: number;
  feedFreshness?: FeedFreshnessStatus;
  klerosTag?: KlerosAddressTag | null;
};

export function UnknownFeedTooltip({ feed, chainId, feedFreshness, klerosTag }: UnknownFeedTooltipProps) {
  const klerosLabel = formatKlerosAddressTagLabel(klerosTag);

  return (
    <div className="flex w-fit max-w-[22rem] flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex min-w-0 items-center gap-2">
        <IoHelpCircleOutline
          className="shrink-0 text-secondary"
          size={16}
        />
        <div className="min-w-0">
          <div className="font-zen font-bold">{klerosLabel ?? 'Unknown Price Feed'}</div>
          {klerosLabel && <div className="font-zen text-xs text-secondary">Name tag from Kleros Scout</div>}
        </div>
      </div>

      {/* Description */}
      <div className="font-zen text-sm text-gray-600 dark:text-gray-400">
        {klerosLabel
          ? 'Scanner metadata does not classify this feed, so Monarch shows the Kleros tag as a fallback label.'
          : 'This oracle uses an unrecognized price feed contract.'}
      </div>

      <FeedTypeSection feed={feed} />

      <FeedFreshnessSection feedFreshness={feedFreshness} />

      {/* External Links */}
      <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
        <div className="mb-2 font-zen text-sm font-medium text-gray-700 dark:text-gray-300">Links:</div>
        <div className="flex items-center gap-2">
          <Link
            href={getExplorerURL(feed.address as Address, chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-hovered flex items-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-primary no-underline transition-all duration-200 hover:bg-opacity-80"
          >
            <Image
              src={etherscanLogo}
              alt="Etherscan"
              width={12}
              height={12}
              className="rounded-sm"
            />
            Etherscan
          </Link>
          {klerosTag?.dataOriginLink && (
            <Link
              href={klerosTag.dataOriginLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-hovered flex items-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-primary no-underline transition-all duration-200 hover:bg-opacity-80"
            >
              View Tag Source
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
