'use client';

import React from 'react';
import Image from 'next/image';
import { IoWarningOutline, IoHelpCircleOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';
import { MonarchVerifiedIcon } from '@/components/shared/monarch-verified-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { getStandardOracleDataFromMetadata, useOracleMetadata } from '@/hooks/useOracleMetadata';
import { OracleType, OracleVendorIcons, getOracleVendorInfo, type PriceFeedVendors, getOracleType } from '@/utils/oracle';

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
  const { data: oracleMetadataMap, isLoading: isOracleMetadataLoading } = useOracleMetadata(chainId);
  const isWaitingForOracleMetadata = isOracleMetadataLoading && Object.keys(oracleMetadataMap).length === 0;
  const standardOracleData = getStandardOracleDataFromMetadata(oracleMetadataMap, oracleAddress, chainId);

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

  const vendorInfo = getOracleVendorInfo(oracleAddress, chainId, oracleMetadataMap);
  const { coreVendors, taggedVendors, hasMonarchVerified, hasCompletelyUnknown, hasTaggedUnknown } = vendorInfo;
  const displayNames = [
    ...(hasMonarchVerified ? ['Monarch verified'] : []),
    ...coreVendors,
    ...taggedVendors,
    ...(hasCompletelyUnknown ? ['Unknown'] : []),
  ];
  const showTaggedFallbackIcon = !isCustom && !isVaultOnly && !hasMonarchVerified && coreVendors.length === 0 && taggedVendors.length > 0;
  const showGenericFallbackIcon =
    !isCustom && !isVaultOnly && !hasMonarchVerified && coreVendors.length === 0 && taggedVendors.length === 0;

  const content = isWaitingForOracleMetadata ? (
    <div className="flex items-center space-x-1 rounded p-1">
      {showText && <span className="mr-1 text-xs font-medium">Oracle</span>}
      <IoHelpCircleOutline
        className="text-secondary opacity-50"
        size={18}
      />
    </div>
  ) : (
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
      ) : hasCompletelyUnknown ? (
        <>
          {hasMonarchVerified && <MonarchVerifiedIcon size={16} />}
          {coreVendors.map((vendor) => (
            <React.Fragment key={vendor}>{renderVendorIcon(vendor)}</React.Fragment>
          ))}
          <IoHelpCircleOutline
            className="text-secondary"
            size={18}
          />
        </>
      ) : (
        <>
          {hasMonarchVerified && <MonarchVerifiedIcon size={16} />}
          {coreVendors.map((vendor) => (
            <React.Fragment key={vendor}>{renderVendorIcon(vendor)}</React.Fragment>
          ))}
        </>
      )}
    </div>
  );

  if (useTooltip) {
    const getTooltipContent = () => {
      if (isWaitingForOracleMetadata) {
        return (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary font-zen">Oracle metadata</p>
            <p className="text-xs text-secondary font-zen">Classification is loading.</p>
          </div>
        );
      }

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

      if (showGenericFallbackIcon && !hasCompletelyUnknown) {
        return (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary font-zen">{oracleLabel}</p>
            <p className="text-xs text-secondary font-zen">Vendor classification is not available in oracle metadata.</p>
          </div>
        );
      }

      const feedSummary =
        allKnownVendors.length > 0
          ? hasCompletelyUnknown
            ? `${allKnownVendors.join(', ')} and unknown feeds`
            : allKnownVendors.join(', ')
          : hasCompletelyUnknown
            ? 'unknown feeds'
            : hasMonarchVerified
              ? ''
              : 'unknown or unclassified feeds';

      return (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-primary font-zen">{oracleLabel}</p>
          {feedSummary && <p className="text-xs text-secondary font-zen">Uses feeds from {feedSummary}.</p>}
          {hasMonarchVerified && <p className="text-xs text-secondary font-zen">Includes feed metadata verified by Monarch.</p>}
          {hasTaggedUnknown && (
            <p className="text-xs text-secondary font-zen">
              {taggedVendors.join(', ')} {taggedVendors.length === 1 ? 'is' : 'are'} tagged, but not widely used.
            </p>
          )}
        </div>
      );
    };

    return <Tooltip content={getTooltipContent()}>{content}</Tooltip>;
  }

  return content;
}

export default OracleVendorBadge;
