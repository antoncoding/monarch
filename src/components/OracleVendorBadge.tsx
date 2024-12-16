import React from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import Image from 'next/image';
import { IoWarningOutline } from 'react-icons/io5';
import { OracleVendorIcons, OracleVendors, parseOracleVendors } from '@/utils/oracle';
import { MorphoChainlinkOracleData } from '@/utils/types';

type OracleVendorBadgeProps = {
  oracleData: MorphoChainlinkOracleData | null;
  useTooltip?: boolean;
  showText?: boolean;
};

const renderVendorIcon = (vendor: OracleVendors) =>
  OracleVendorIcons[vendor] ? (
    <Image src={OracleVendorIcons[vendor]} alt={vendor} width={16} height={16} />
  ) : (
    <IoWarningOutline className="text-secondary" size={16} />
  );

function OracleVendorBadge({
  oracleData,
  showText = false,
  useTooltip = true,
}: OracleVendorBadgeProps) {
  const { vendors } = parseOracleVendors(oracleData);

  const noFeeds = vendors.length === 0;

  const content = (
    <div className="flex items-center space-x-1 rounded p-1">
      {showText && (
        <span className="mr-1 text-xs font-medium">
          {noFeeds ? 'No Oracle' : vendors.join(', ')}
        </span>
      )}
      {noFeeds ? (
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
              {noFeeds ? 'No Oracle Feed Used' : 'Oracle Vendors:'}
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
