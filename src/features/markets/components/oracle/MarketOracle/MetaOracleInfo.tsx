'use client';

import { useMemo } from 'react';
import { useFeedLastUpdatedByChain, type FeedSnapshotByAddress } from '@/hooks/useFeedLastUpdatedByChain';
import { getMetaOracleDataFromMetadata, type OracleOutputData, useOracleMetadata } from '@/hooks/useOracleMetadata';
import { AddressIdentity } from '@/components/shared/address-identity';
import { KlerosTagBadge } from '@/components/shared/kleros-tag-badge';
import { formatKlerosAddressTagLabel, getKlerosAddressTagKey, type KlerosAddressTagsByKey } from '@/data-sources/kleros/address-tags';
import { formatOracleDuration } from '@/utils/oracle';
import { useKlerosAddressTagsQuery } from '@/hooks/queries/useKlerosAddressTagsQuery';
import { FeedEntry } from './FeedEntry';
import { VaultEntry } from './VaultEntry';

type MetaOracleInfoProps = {
  oracleAddress: string;
  chainId: number;
  variant?: 'summary' | 'detail';
};

function getOracleFeedAddresses(oracleData: OracleOutputData | null): string[] {
  return [oracleData?.baseFeedOne?.address, oracleData?.baseFeedTwo?.address, oracleData?.quoteFeedOne?.address, oracleData?.quoteFeedTwo?.address].filter(
    (address): address is string => Boolean(address),
  );
}

function OracleFeedSection({
  oracleData,
  chainId,
  label,
  feedSnapshotsByAddress,
  klerosAddressTags,
}: {
  oracleData: OracleOutputData | null;
  chainId: number;
  label: string;
  feedSnapshotsByAddress: FeedSnapshotByAddress;
  klerosAddressTags?: KlerosAddressTagsByKey;
}) {
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
                <VaultEntry
                  vault={vault}
                  chainId={chainId}
                />
              )}
              {activeFeeds.map((enrichedFeed) => {
                if (!enrichedFeed) return null;
                return (
                  <FeedEntry
                    key={enrichedFeed.address}
                    feed={enrichedFeed}
                    chainId={chainId}
                    feedSnapshotsByAddress={feedSnapshotsByAddress}
                    klerosTag={klerosAddressTags?.[getKlerosAddressTagKey(chainId, enrichedFeed.address)]}
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
  const { data: feedSnapshotsByAddress } = useFeedLastUpdatedByChain(chainId);

  const metaData = getMetaOracleDataFromMetadata(oracleMetadataMap, oracleAddress, chainId);
  const isPrimaryActive = Boolean(metaData?.currentOracle?.toLowerCase() === metaData?.primaryOracle?.toLowerCase());
  const feedAddresses = useMemo(() => {
    if (!metaData) return [];

    const activeOracleData = isPrimaryActive ? metaData.oracleSources.primary : metaData.oracleSources.backup;
    const oracleSources = variant === 'detail' ? [metaData.oracleSources.primary, metaData.oracleSources.backup] : [activeOracleData];
    const oracleContractAddresses = variant === 'detail' ? [metaData.primaryOracle, metaData.backupOracle] : [];

    return [...oracleContractAddresses, ...oracleSources.flatMap(getOracleFeedAddresses)];
  }, [isPrimaryActive, metaData, variant]);
  // Batch Kleros tags for the meta oracle contracts and feeds currently rendered in this view.
  const { data: klerosAddressTags } = useKlerosAddressTagsQuery(chainId, feedAddresses);

  if (!metaData) return null;
  const primaryOracleTag = klerosAddressTags?.[getKlerosAddressTagKey(chainId, metaData.primaryOracle)];
  const primaryOracleLabel = formatKlerosAddressTagLabel(primaryOracleTag);
  const backupOracleTag = klerosAddressTags?.[getKlerosAddressTagKey(chainId, metaData.backupOracle)];
  const backupOracleLabel = formatKlerosAddressTagLabel(backupOracleTag);

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
            {primaryOracleLabel && (
              <span className="inline-flex max-w-[12rem] rounded-sm bg-hovered px-2 py-1 font-zen text-xs text-secondary">
                <KlerosTagBadge
                  label={primaryOracleLabel}
                  publicNote={primaryOracleTag?.publicNote}
                />
              </span>
            )}
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
            feedSnapshotsByAddress={feedSnapshotsByAddress}
            klerosAddressTags={klerosAddressTags}
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
            {backupOracleLabel && (
              <span className="inline-flex max-w-[12rem] rounded-sm bg-hovered px-2 py-1 font-zen text-xs text-secondary">
                <KlerosTagBadge
                  label={backupOracleLabel}
                  publicNote={backupOracleTag?.publicNote}
                />
              </span>
            )}
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
            feedSnapshotsByAddress={feedSnapshotsByAddress}
            klerosAddressTags={klerosAddressTags}
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
      feedSnapshotsByAddress={feedSnapshotsByAddress}
      klerosAddressTags={klerosAddressTags}
    />
  );
}
