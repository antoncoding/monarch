import Link from 'next/link';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import { getFeedMechanism } from '@/utils/oracle';
import { FeedMechanismBadge } from './FeedMechanismBadge';
import { FeedTypeBadge, getFeedTypeInfo } from './FeedTypeBadge';
import { FeedTypesModal } from './FeedTypesModal';

type FeedTypeSectionProps = {
  feed: EnrichedFeed;
};

export function FeedTypeSection({ feed }: FeedTypeSectionProps) {
  const { toggleModal, closeModal } = useGlobalModal();
  const mechanism = getFeedMechanism(feed);

  if (!feed.feedType && !mechanism) return null;

  const info = getFeedTypeInfo(feed.feedType);

  return (
    <div className="rounded-sm border border-gray-200/40 bg-hovered p-3 dark:border-gray-600/20">
      <div className="flex items-start gap-2 font-zen text-sm">
        <div className="min-w-0 flex-1 space-y-1.5">
          {feed.feedType && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Feed Type:</span>
              <FeedTypeBadge feedType={feed.feedType} />
            </div>
          )}
          {mechanism && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Mechanism:</span>
              <FeedMechanismBadge mechanism={mechanism} />
            </div>
          )}
        </div>
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleModal(
              <FeedTypesModal
                isOpen
                onClose={() => closeModal()}
              />,
            );
          }}
          className="mt-0.5 cursor-pointer text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
          type="button"
          aria-label="Learn about feed types and pricing mechanisms"
        >
          <IoHelpCircleOutline size={14} />
        </button>
      </div>
      {feed.feedType && <p className="mt-2 font-zen text-xs text-gray-600 dark:text-gray-400">{info.description}</p>}
      {mechanism && (
        <p className="mt-1 font-zen text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Mechanism: </span>
          {mechanism.description}
        </p>
      )}
      {feed.feedType && (
        <Link
          href={info.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex font-zen text-xs font-medium text-primary no-underline hover:underline"
        >
          Read {info.label} feed docs
        </Link>
      )}
    </div>
  );
}
