import React from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import Image from 'next/image';
import { IoWarningOutline } from 'react-icons/io5';
import { parseOracleVendors } from '@/utils/oracle';
import { MorphoChainlinkOracleData } from '@/utils/types';

type OracleVendorBadgeProps = {
  oracleData: MorphoChainlinkOracleData;
  showTooltip?: boolean;
};

const OracleVendorBadge: React.FC<OracleVendorBadgeProps> = ({
  oracleData,
  showTooltip = true,
}) => {
  const { vendors, isUnknown } = parseOracleVendors(oracleData);

  const getVendorIcon = (vendor: string) => {
    switch (vendor) {
      case 'Chainlink':
        return require('../imgs/oracles/chainlink.png');
      case 'Pyth Network':
        return require('../imgs/oracles/pyth.png');
      default:
        return null;
    }
  };

  const tooltipContent = (
    <div className="m-2">
      <p className="text-sm font-medium">Oracle Vendors:</p>
      <ul>
        {vendors.map((vendor, index) => (
          <li key={index} className="text-xs">
            {vendor}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Tooltip content={showTooltip ? tooltipContent : undefined} className="rounded-sm">
      <div className="flex space-x-1">
        {isUnknown ? (
          <IoWarningOutline />
        ) : (
          vendors.map((vendor, index) => (
            <Image
              key={index}
              src={getVendorIcon(vendor)}
              alt={vendor}
              width={16}
              height={16}
              className={isUnknown ? 'opacity-50' : ''}
            />
          ))
        )}
      </div>
    </Tooltip>
  );
};

export default OracleVendorBadge;
