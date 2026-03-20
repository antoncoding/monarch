'use client';

import React from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { IoWarningOutline, IoHelpCircleOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';
import {
  OracleType,
  OracleVendorIcons,
  type PriceFeedVendors,
  getOracleType,
  parseMetaOracleVendors,
  parsePriceFeedVendors,
} from '@/utils/oracle';
import { getMetaOracleDataFromMetadata, getStandardOracleDataFromMetadata, useOracleMetadata } from '@/hooks/useOracleMetadata';

type OracleVendorBadgeProps = {
  chainId: number;
  oracleAddress?: string;
  useTooltip?: boolean;
  showText?: boolean;
};

const renderVendorIcon = (vendor: PriceFeedVendors) =>
  OracleVendorIcons[vendor] ? (
    <Image
      src={OracleVendorIcons[vendor]}
      alt={vendor}
      width={16}
      height={16}
    />
  ) : (
    <IoHelpCircleOutline
      className="text-secondary"
      size={18}
    />
  );

function OracleVendorBadge({ chainId, oracleAddress, showText = false, useTooltip = true }: OracleVendorBadgeProps) {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);
  const standardOracleData = getStandardOracleDataFromMetadata(oracleMetadataMap, oracleAddress, chainId);
  const metaOracleData = getMetaOracleDataFromMetadata(oracleMetadataMap, oracleAddress, chainId);

  const oracleType = getOracleType(oracleAddress, chainId, oracleMetadataMap);
  const isCustom = oracleType === OracleType.Custom;
  const isMeta = oracleType === OracleType.Meta;

  const isVaultOnly =
    oracleType === OracleType.Standard &&
    !standardOracleData?.baseFeedOne &&
    !standardOracleData?.baseFeedTwo &&
    !standardOracleData?.quoteFeedOne &&
    !standardOracleData?.quoteFeedTwo &&
    (standardOracleData?.baseVault || standardOracleData?.quoteVault);

  const vendorInfo = isMeta && metaOracleData ? parseMetaOracleVendors(metaOracleData) : parsePriceFeedVendors(standardOracleData);
  const { coreVendors, taggedVendors, hasCompletelyUnknown, hasTaggedUnknown } = vendorInfo;
  const hasUnknownFeed = hasCompletelyUnknown || hasTaggedUnknown;
  const displayNames = hasUnknownFeed ? [...coreVendors, ...taggedVendors, 'Unverified'] : [...coreVendors, ...taggedVendors];
  const showTaggedFallbackIcon = !isCustom && !isVaultOnly && coreVendors.length === 0 && taggedVendors.length > 0;
  const showGenericFallbackIcon = !isCustom && !isVaultOnly && coreVendors.length === 0 && taggedVendors.length === 0;

  const content = (
    <div className="flex items-center space-x-1 rounded p-1">
      {showText && <span className="mr-1 text-xs font-medium">{displayNames.join(', ') || 'Oracle'}</span>}
      {isCustom ? (
        <IoWarningOutline
          className="text-secondary"
          size={16}
        />
      ) : isVaultOnly ? (
        <IoCheckmarkCircleOutline
          className="text-secondary"
          size={16}
        />
      ) : showTaggedFallbackIcon || showGenericFallbackIcon ? (
        <IoHelpCircleOutline
          className="text-secondary"
          size={18}
        />
      ) : hasUnknownFeed ? (
        <>
          {coreVendors.map((vendor, index) => (
            <React.Fragment key={index}>{renderVendorIcon(vendor)}</React.Fragment>
          ))}
          <IoHelpCircleOutline
            className="text-secondary"
            size={18}
          />
        </>
      ) : (
        coreVendors.map((vendor, index) => <React.Fragment key={index}>{renderVendorIcon(vendor)}</React.Fragment>)
      )}
    </div>
  );

  if (useTooltip) {
    const getTooltipContent = () => {
      if (isCustom) {
        return (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary font-zen">Custom Oracle</p>
            <p className="text-xs text-secondary font-zen">Uses an unrecognized oracle contract.</p>
          </div>
        );
      }

      if (isVaultOnly) {
        return (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary font-zen">Standard Oracle</p>
            <p className="text-xs text-secondary font-zen">Uses onchain vault contract for price conversion.</p>
          </div>
        );
      }

      const oracleLabel = isMeta ? 'Meta Oracle' : 'Standard Oracle';
      const allKnownVendors = [...coreVendors, ...taggedVendors];

      if (showGenericFallbackIcon && !hasUnknownFeed) {
        return (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary font-zen">{oracleLabel}</p>
            <p className="text-xs text-secondary font-zen">Vendor classification is not available in oracle metadata.</p>
          </div>
        );
      }

      const feedSummary =
        allKnownVendors.length > 0
          ? hasUnknownFeed
            ? `${allKnownVendors.join(', ')} and unverified feeds`
            : allKnownVendors.join(', ')
          : 'unverified or unclassified feeds';

      return (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-primary font-zen">{oracleLabel}</p>
          <p className="text-xs text-secondary font-zen">Uses feeds from {feedSummary}.</p>
        </div>
      );
    };

    return <Tooltip content={getTooltipContent()}>{content}</Tooltip>;
  }

  return content;
}

export default OracleVendorBadge;
