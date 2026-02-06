'use client';

import React from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { IoWarningOutline, IoHelpCircleOutline } from 'react-icons/io5';
import { OracleType, OracleVendorIcons, type PriceFeedVendors, getOracleType, parsePriceFeedVendors } from '@/utils/oracle';
import { useOracleMetadata } from '@/hooks/useOracleMetadata';
import type { MorphoChainlinkOracleData } from '@/utils/types';

type OracleVendorBadgeProps = {
  oracleData: MorphoChainlinkOracleData | null | undefined;
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

/**
 * IoWarningOutline: Unknown Oracles
 * IoHelpCircleOutline: For unknown feeds
 */

function OracleVendorBadge({ oracleData, chainId, oracleAddress, showText = false, useTooltip = true }: OracleVendorBadgeProps) {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);

  // check whether it's standard oracle or not.
  const isCustom = getOracleType(oracleData) === OracleType.Custom;

  const vendorInfo = parsePriceFeedVendors(oracleData, chainId, {
    metadataMap: oracleMetadataMap,
    oracleAddress,
  });
  const { coreVendors, taggedVendors, hasCompletelyUnknown, hasTaggedUnknown, vendors, hasUnknown } = vendorInfo;

  const content = (
    <div className="flex items-center space-x-1 rounded p-1">
      {showText && <span className="mr-1 text-xs font-medium">{hasUnknown ? 'Unknown' : vendors.join(', ')}</span>}
      {isCustom ? (
        <IoWarningOutline
          className="text-secondary"
          size={16}
        />
      ) : hasCompletelyUnknown || hasTaggedUnknown ? (
        // Show core vendor icons plus question mark for any unknown types
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
        // Only core vendors, show their icons
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

      if (hasCompletelyUnknown || hasTaggedUnknown) {
        let description = '';
        const parts = [];

        if (coreVendors.length > 0) {
          parts.push(`${coreVendors.join(', ')}`);
        }

        if (taggedVendors.length > 0) {
          parts.push(`${taggedVendors.join(', ')} (third-party)`);
        }

        if (hasCompletelyUnknown) {
          const unknownCount = 1; // Simplified for now
          parts.push(`${unknownCount} unrecognized feed${unknownCount > 1 ? 's' : ''}`);
        }

        description = `Uses feeds from: ${parts.join(', ')}.`;

        return (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary font-zen">Standard Oracle</p>
            <p className="text-xs text-secondary font-zen">{description}</p>
          </div>
        );
      }

      // All core vendors - clean case
      const allVendors = [...coreVendors, ...taggedVendors];
      return (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-primary font-zen">Standard Oracle</p>
          <p className="text-xs text-secondary font-zen">Uses feeds from {allVendors.join(', ')}.</p>
        </div>
      );
    };

    return <Tooltip content={getTooltipContent()}>{content}</Tooltip>;
  }

  return content;
}

export default OracleVendorBadge;
