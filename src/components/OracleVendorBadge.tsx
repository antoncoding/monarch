import React from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { IoWarningOutline, IoHelpCircleOutline } from 'react-icons/io5';
import {
  OracleType,
  OracleVendorIcons,
  PriceFeedVendors,
  getOracleType,
  parsePriceFeedVendors,
} from '@/utils/oracle';
import { MorphoChainlinkOracleData } from '@/utils/types';

type OracleVendorBadgeProps = {
  oracleData: MorphoChainlinkOracleData | null | undefined;
  chainId: number;
  useTooltip?: boolean;
  showText?: boolean;
};

const renderVendorIcon = (vendor: PriceFeedVendors) =>
  OracleVendorIcons[vendor] ? (
    <Image src={OracleVendorIcons[vendor]} alt={vendor} width={16} height={16} />
  ) : (
    <IoHelpCircleOutline className="text-secondary" size={18} />
  );

/**
 * IoWarningOutline: Unknown Oracles
 * IoHelpCircleOutline: For unknown feeds
 */

function OracleVendorBadge({
  oracleData,
  chainId,
  showText = false,
  useTooltip = true,
}: OracleVendorBadgeProps) {
  // check whether it's standard oracle or not.
  const isCustom = getOracleType(oracleData) === OracleType.Custom;

  const vendorInfo = parsePriceFeedVendors(oracleData, chainId);
  const {
    coreVendors,
    taggedVendors,
    hasCompletelyUnknown,
    hasTaggedUnknown,
    vendors,
    hasUnknown,
  } = vendorInfo;

  const content = (
    <div className="flex items-center space-x-1 rounded p-1">
      {showText && (
        <span className="mr-1 text-xs font-medium">
          {hasUnknown ? 'Unknown' : vendors.join(', ')}
        </span>
      )}
      {isCustom ? (
        <IoWarningOutline className="text-secondary" size={16} />
      ) : hasCompletelyUnknown || hasTaggedUnknown ? (
        // Show core vendor icons plus question mark for any unknown types
        <>
          {coreVendors.map((vendor, index) => (
            <React.Fragment key={index}>{renderVendorIcon(vendor)}</React.Fragment>
          ))}
          <IoHelpCircleOutline className="text-secondary" size={18} />
        </>
      ) : (
        // Only core vendors, show their icons
        coreVendors.map((vendor, index) => (
          <React.Fragment key={index}>{renderVendorIcon(vendor)}</React.Fragment>
        ))
      )}
    </div>
  );

  if (useTooltip) {
    const getTooltipContent = () => {
      if (isCustom) {
        return (
          <div className="m-2">
            <p className="py-2 text-sm font-medium">Custom Oracle</p>
            <p className="text-xs text-secondary">Uses an unrecognized oracle contract.</p>
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
          <div className="m-2">
            <p className="py-2 text-sm font-medium">Standard Oracle</p>
            <p className="text-xs text-secondary">{description}</p>
          </div>
        );
      }

      // All core vendors - clean case
      const allVendors = [...coreVendors, ...taggedVendors];
      return (
        <div className="m-2">
          <p className="py-2 text-sm font-medium">Standard Oracle</p>
          <p className="text-xs text-secondary">Uses feeds from {allVendors.join(', ')}.</p>
        </div>
      );
    };

    return (
      <Tooltip content={getTooltipContent()} className="rounded-sm">
        {content}
      </Tooltip>
    );
  }

  return content;
}

export default OracleVendorBadge;
