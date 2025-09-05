import React from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { IoWarningOutline } from 'react-icons/io5';
import { OracleVendorIcons, PriceFeedVendors, parsePriceFeedVendors } from '@/utils/oracle';
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
    <IoWarningOutline className="text-secondary" size={16} />
  );

function OracleVendorBadge({
  oracleData,
  chainId,
  showText = false,
  useTooltip = true,
}: OracleVendorBadgeProps) {
  const { vendors, hasUnknown } = parsePriceFeedVendors(oracleData, chainId);

  const content = (
    <div className="flex items-center space-x-1 rounded p-1">
      {showText && (
        <span className="mr-1 text-xs font-medium">
          {hasUnknown ? 'Unknown' : vendors.join(', ')}
        </span>
      )}
      {hasUnknown ? (
        <IoWarningOutline className="text-secondary" size={16} />
      ) : (
        vendors.map((vendor, index) => (
          <React.Fragment key={index}>{renderVendorIcon(vendor)}</React.Fragment>
        ))
      )}
    </div>
  );

  if (useTooltip) {
    return (
      <Tooltip
        content={
          <div className="m-2">
            <p className="py-2 text-sm font-medium">
              {hasUnknown ? 'Unknown Oracle' : 'Oracle Vendors:'}
            </p>
            <ul>
              {vendors.map((vendor, index) => (
                <li key={index} className="text-xs">
                  {vendor}
                </li>
              ))}
            </ul>
          </div>
        }
        className="rounded-sm"
      >
        {content}
      </Tooltip>
    );
  }

  return content;
}

export default OracleVendorBadge;
