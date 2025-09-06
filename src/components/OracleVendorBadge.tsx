import React from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { IoWarningOutline, IoHelpCircleOutline } from 'react-icons/io5';
import { OracleType, OracleVendorIcons, PriceFeedVendors, getOracleType, parsePriceFeedVendors } from '@/utils/oracle';
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
  const isCustom = getOracleType(oracleData) === OracleType.Custom

  const { vendors, hasUnknown } = parsePriceFeedVendors(oracleData, chainId);

  const content = (
    <div className="flex items-center space-x-1 rounded p-1">
      {showText && (
        <span className="mr-1 text-xs font-medium">
          {hasUnknown ? 'Unknown' : vendors.join(', ')}
        </span>
      )}
      {isCustom ? (
        <IoWarningOutline className="text-secondary" size={16} />
      ) : (
        vendors.map((vendor, index) => (
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

      if (hasUnknown) {
        const knownVendors = vendors.filter(v => v !== PriceFeedVendors.Unknown);
        const unknownCount = vendors.filter(v => v === PriceFeedVendors.Unknown).length;
        
        let description = '';
        if (knownVendors.length > 0) {
          description = `Uses feeds from ${knownVendors.join(', ')}, plus ${unknownCount} unknown feed${unknownCount > 1 ? 's' : ''}.`;
        } else {
          description = `Uses ${unknownCount} unknown feed${unknownCount > 1 ? 's' : ''} only.`;
        }
        
        return (
          <div className="m-2">
            <p className="py-2 text-sm font-medium">Standard Oracle</p>
            <p className="text-xs text-secondary">{description}</p>
          </div>
        );
      }

      return (
        <div className="m-2">
          <p className="py-2 text-sm font-medium">Standard Oracle</p>
          <p className="text-xs text-secondary">Uses feeds from {vendors.join(', ')}.</p>
        </div>
      );
    };

    return (
      <Tooltip
        content={getTooltipContent()}
        className="rounded-sm"
      >
        {content}
      </Tooltip>
    );
  }

  return content;
}

export default OracleVendorBadge;
