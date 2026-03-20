'use client';

import { useFeedLastUpdatedByChain } from '@/hooks/useFeedLastUpdatedByChain';
import { getStandardOracleDataFromMetadata, useOracleMetadata } from '@/hooks/useOracleMetadata';
import { FeedEntry } from './FeedEntry';
import { VaultEntry } from './VaultEntry';

type MarketOracleFeedInfoProps = {
  chainId: number;
  oracleAddress?: string;
};

export function MarketOracleFeedInfo({ chainId, oracleAddress }: MarketOracleFeedInfoProps): JSX.Element {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);
  const { data: feedSnapshotsByAddress } = useFeedLastUpdatedByChain(chainId);

  const oracleData = getStandardOracleDataFromMetadata(oracleMetadataMap, oracleAddress, chainId);
  const baseVault = oracleData?.baseVault ?? null;
  const quoteVault = oracleData?.quoteVault ?? null;
  const baseFeedOne = oracleData?.baseFeedOne ?? null;
  const baseFeedTwo = oracleData?.baseFeedTwo ?? null;
  const quoteFeedOne = oracleData?.quoteFeedOne ?? null;
  const quoteFeedTwo = oracleData?.quoteFeedTwo ?? null;

  const hasAnyFeed = baseFeedOne || baseFeedTwo || quoteFeedOne || quoteFeedTwo;
  const hasAnyVault = baseVault || quoteVault;

  if (!hasAnyFeed && !hasAnyVault) {
    return <div className="text-center text-sm text-gray-500 dark:text-gray-400">No feed routes available</div>;
  }

  return (
    <div className="space-y-2">
      {(baseVault || baseFeedOne || baseFeedTwo) && (
        <div className="flex items-center justify-between">
          <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">Base:</span>
          <div className="flex justify-end gap-2">
            {baseVault && (
              <VaultEntry
                vault={baseVault}
                chainId={chainId}
              />
            )}
            {baseFeedOne && (
              <FeedEntry
                feed={baseFeedOne}
                chainId={chainId}
                feedSnapshotsByAddress={feedSnapshotsByAddress}
              />
            )}
            {baseFeedTwo && (
              <FeedEntry
                feed={baseFeedTwo}
                chainId={chainId}
                feedSnapshotsByAddress={feedSnapshotsByAddress}
              />
            )}
          </div>
        </div>
      )}

      {(quoteVault || quoteFeedOne || quoteFeedTwo) && (
        <div className="flex items-center justify-between">
          <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">Quote:</span>
          <div className="flex justify-end gap-2">
            {quoteVault && (
              <VaultEntry
                vault={quoteVault}
                chainId={chainId}
              />
            )}
            {quoteFeedOne && (
              <FeedEntry
                feed={quoteFeedOne}
                chainId={chainId}
                feedSnapshotsByAddress={feedSnapshotsByAddress}
              />
            )}
            {quoteFeedTwo && (
              <FeedEntry
                feed={quoteFeedTwo}
                chainId={chainId}
                feedSnapshotsByAddress={feedSnapshotsByAddress}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
