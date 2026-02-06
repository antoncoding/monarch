'use client';

import { useOracleMetadata } from '@/hooks/useOracleMetadata';
import type { OracleFeed } from '@/utils/types';
import { FeedEntry } from './FeedEntry';

type MarketOracleFeedInfoProps = {
  baseFeedOne: OracleFeed | null | undefined;
  baseFeedTwo: OracleFeed | null | undefined;
  quoteFeedOne: OracleFeed | null | undefined;
  quoteFeedTwo: OracleFeed | null | undefined;
  chainId: number;
  oracleAddress?: string;
};

export function MarketOracleFeedInfo({
  baseFeedOne,
  baseFeedTwo,
  quoteFeedOne,
  quoteFeedTwo,
  chainId,
  oracleAddress,
}: MarketOracleFeedInfoProps): JSX.Element {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);
  const hasAnyFeed = baseFeedOne || baseFeedTwo || quoteFeedOne || quoteFeedTwo;

  if (!hasAnyFeed) {
    return <div className="text-center text-sm text-gray-500 dark:text-gray-400">No feed routes available</div>;
  }

  return (
    <div className="space-y-2">
      {(baseFeedOne || baseFeedTwo) && (
        <div className="flex items-center justify-between">
          <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">Base:</span>
          <div className="flex justify-end gap-2">
            {baseFeedOne && (
              <FeedEntry
                feed={baseFeedOne}
                chainId={chainId}
                oracleAddress={oracleAddress}
                oracleMetadataMap={oracleMetadataMap}
              />
            )}
            {baseFeedTwo && (
              <FeedEntry
                feed={baseFeedTwo}
                chainId={chainId}
                oracleAddress={oracleAddress}
                oracleMetadataMap={oracleMetadataMap}
              />
            )}
          </div>
        </div>
      )}

      {(quoteFeedOne || quoteFeedTwo) && (
        <div className="flex items-center justify-between">
          <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">Quote:</span>
          <div className="flex justify-end gap-2">
            {quoteFeedOne && (
              <FeedEntry
                feed={quoteFeedOne}
                chainId={chainId}
                oracleAddress={oracleAddress}
                oracleMetadataMap={oracleMetadataMap}
              />
            )}
            {quoteFeedTwo && (
              <FeedEntry
                feed={quoteFeedTwo}
                chainId={chainId}
                oracleAddress={oracleAddress}
                oracleMetadataMap={oracleMetadataMap}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
