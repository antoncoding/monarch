import React from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import Image from 'next/image';
import { IoWarningOutline } from 'react-icons/io5';
import { OracleVendors, OracleVendorIcons, parseOracleVendors } from '@/utils/oracle';
import { MorphoChainlinkOracleData } from '@/utils/types';

type OracleVendorBadgeProps = {
  oracleData: MorphoChainlinkOracleData;
  useTooltip?: boolean;
};

const OracleVendorBadge: React.FC<OracleVendorBadgeProps> = ({ oracleData, useTooltip = true }) => {
  const { vendors } = parseOracleVendors(oracleData);

  const noFeeds = vendors.length === 0;

  const content = (
    <div className={`flex items-center space-x-1 ${useTooltip ? '' : 'rounded bg-primary p-1'}`}>
      {!useTooltip && (
        <span className="mr-1 text-xs font-medium">
          {noFeeds ? 'No Feeds' : vendors.join(', ')}:
        </span>
      )}
      {noFeeds ? (
        <IoWarningOutline className="text-secondary" size={16} />
      ) : (
        vendors.map((vendor, index) => (
          <React.Fragment key={index}>
            {OracleVendorIcons[vendor] ? (
              <Image src={OracleVendorIcons[vendor]} alt={vendor} width={16} height={16} />
            ) : (
              <IoWarningOutline className="text-secondary" size={16} />
            )}
          </React.Fragment>
        ))
      )}
    </div>
  );

  if (useTooltip) {
    return (
      <Tooltip
        content={
          <div className="m-2">
            <p className="text-sm font-medium">{noFeeds ? 'No live oralce' : 'Oracle Vendors:'}</p>
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
};

export default OracleVendorBadge;
