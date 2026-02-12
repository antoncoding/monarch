'use client';

import { useOracleMetadata, getOracleFromMetadata, isMetaOracleData, type OracleOutputData } from '@/hooks/useOracleMetadata';
import { AddressIdentity } from '@/components/shared/address-identity';
import type { OracleFeed } from '@/utils/types';
import { formatOracleDuration } from '@/utils/oracle';
import { FeedEntry } from './FeedEntry';
import { VaultEntry } from './VaultEntry';

type MetaOracleInfoProps = {
  oracleAddress: string;
  chainId: number;
  variant?: 'summary' | 'detail';
};

function OracleFeedSection({ oracleData, chainId, label }: { oracleData: OracleOutputData | null; chainId: number; label: string }) {
  if (!oracleData) return null;

  const feedGroups = [
    { label: 'Base', feeds: [oracleData.baseFeedOne, oracleData.baseFeedTwo], vault: oracleData.baseVault ?? null },
    { label: 'Quote', feeds: [oracleData.quoteFeedOne, oracleData.quoteFeedTwo], vault: oracleData.quoteVault ?? null },
  ];

  return (
    <div className="space-y-1">
      {feedGroups.map(({ label: feedLabel, feeds, vault }) => {
        const activeFeeds = feeds.filter(Boolean);
        if (activeFeeds.length === 0 && !vault) return null;
        return (
          <div
            key={`${label}-${feedLabel}`}
            className="flex items-center justify-between"
          >
            <span className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400 pl-2">{feedLabel}:</span>
            <div className="flex justify-end gap-2">
              {vault && (
                <VaultEntry vault={vault} chainId={chainId} />
              )}
              {activeFeeds.map((enrichedFeed) => {
                if (!enrichedFeed) return null;
                const oracleFeed: OracleFeed = {
                  address: enrichedFeed.address,
                  chain: { id: chainId },
                  id: enrichedFeed.address,
                  pair: enrichedFeed.pair.length === 2 ? [enrichedFeed.pair[0], enrichedFeed.pair[1]] : null,
                };
                return (
                  <FeedEntry
                    key={enrichedFeed.address}
                    feed={oracleFeed}
                    chainId={chainId}
                    enrichedFeed={enrichedFeed}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MetaOracleInfo({ oracleAddress, chainId, variant = 'summary' }: MetaOracleInfoProps) {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);

  const oracleMetadata = getOracleFromMetadata(oracleMetadataMap, oracleAddress);
  if (!oracleMetadata?.data || !isMetaOracleData(oracleMetadata.data)) return null;

  const metaData = oracleMetadata.data;
  const isPrimaryActive = metaData.currentOracle?.toLowerCase() === metaData.primaryOracle?.toLowerCase();

  if (variant === 'detail') {
    const deviationPct = (Number(metaData.deviationThreshold) / 1e18) * 100;

    return (
      <div className="space-y-3">
        {/* Primary oracle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Primary:</span>
            <AddressIdentity
              address={metaData.primaryOracle}
              chainId={chainId}
            />
            {isPrimaryActive && (
              <span className="rounded-sm bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-400/10 dark:text-green-300">
                Active
              </span>
            )}
          </div>
          <OracleFeedSection
            oracleData={metaData.oracleSources.primary}
            chainId={chainId}
            label="primary"
          />
        </div>

        {/* Backup oracle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Backup:</span>
            <AddressIdentity
              address={metaData.backupOracle}
              chainId={chainId}
            />
            {!isPrimaryActive && (
              <span className="rounded-sm bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-400/10 dark:text-green-300">
                Active
              </span>
            )}
          </div>
          <OracleFeedSection
            oracleData={metaData.oracleSources.backup}
            chainId={chainId}
            label="backup"
          />
        </div>

        {/* Parameters */}
        <div className="space-y-1 border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
            <span className="text-xs font-medium">{deviationPct}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Challenge Timelock:</span>
            <span className="text-xs font-medium">{formatOracleDuration(metaData.challengeTimelockDuration)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Healing Timelock:</span>
            <span className="text-xs font-medium">{formatOracleDuration(metaData.healingTimelockDuration)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Summary variant: just show current oracle's feeds
  const currentOracleData = isPrimaryActive ? metaData.oracleSources.primary : metaData.oracleSources.backup;
  if (!currentOracleData) return null;

  return (
    <OracleFeedSection
      oracleData={currentOracleData}
      chainId={chainId}
      label="current"
    />
  );
}
