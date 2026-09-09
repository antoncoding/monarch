'use client';

import { useFeedLastUpdatedByChain } from '@/hooks/useFeedLastUpdatedByChain';
import { getOracleFeedData, getOracleFromMetadata, useOracleMetadata } from '@/hooks/useOracleMetadata';
import { FeedEntry } from './FeedEntry';
import { VaultEntry } from './VaultEntry';

type MarketOracleFeedInfoProps = {
  chainId: number;
  oracleAddress?: string;
};

export function MarketOracleFeedInfo({ chainId, oracleAddress }: MarketOracleFeedInfoProps): JSX.Element {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);

  const oracle = getOracleFromMetadata(oracleMetadataMap, oracleAddress, chainId);
  const oracleData = getOracleFeedData(oracle);
  const baseVault = oracleData?.baseVault ?? null;
  const quoteVault = oracleData?.quoteVault ?? null;
  const baseFeedOne = oracleData?.baseFeedOne ?? null;
  const baseFeedTwo = oracleData?.baseFeedTwo ?? null;
  const quoteFeedOne = oracleData?.quoteFeedOne ?? null;
  const quoteFeedTwo = oracleData?.quoteFeedTwo ?? null;

  const hasAnyFeed = baseFeedOne || baseFeedTwo || quoteFeedOne || quoteFeedTwo;
  const hasAnyVault = baseVault || quoteVault;
  const { data: feedSnapshotsByAddress, isLoading: isSnapshotPending } = useFeedLastUpdatedByChain(hasAnyFeed ? chainId : undefined);

  if (!hasAnyFeed && !hasAnyVault) {
    return (
      <div className="text-xs text-secondary">
        {oracle?.type === 'custom' ? 'Feed dependencies unavailable' : 'No feed routes available'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(baseVault || baseFeedOne || baseFeedTwo) && (
        <div className="flex items-start justify-between gap-2">
          <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">Base:</span>
          <div className="flex min-w-0 flex-wrap justify-end gap-2">
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
                isSnapshotPending={isSnapshotPending}
              />
            )}
            {baseFeedTwo && (
              <FeedEntry
                feed={baseFeedTwo}
                chainId={chainId}
                feedSnapshotsByAddress={feedSnapshotsByAddress}
                isSnapshotPending={isSnapshotPending}
              />
            )}
          </div>
        </div>
      )}

      {(quoteVault || quoteFeedOne || quoteFeedTwo) && (
        <div className="flex items-start justify-between gap-2">
          <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">Quote:</span>
          <div className="flex min-w-0 flex-wrap justify-end gap-2">
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
                isSnapshotPending={isSnapshotPending}
              />
            )}
            {quoteFeedTwo && (
              <FeedEntry
                feed={quoteFeedTwo}
                chainId={chainId}
                feedSnapshotsByAddress={feedSnapshotsByAddress}
                isSnapshotPending={isSnapshotPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
