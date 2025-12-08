import Link from 'next/link';
import { FiExternalLink } from 'react-icons/fi';
import { MarketOracleFeedInfo } from '@/components/MarketOracle';
import { getExplorerURL } from '@/utils/external';
import { getOracleType, getOracleTypeDescription, OracleType } from '@/utils/oracle';
import type { MorphoChainlinkOracleData } from '@/utils/types';

type OracleTypeInfoProps = {
  oracleData: MorphoChainlinkOracleData | null | undefined;
  oracleAddress: string;
  chainId: number;
  showLink?: boolean;
  showCustom?: boolean;
};

export function OracleTypeInfo({ oracleData, oracleAddress, chainId, showLink, showCustom }: OracleTypeInfoProps) {
  const oracleType = getOracleType(oracleData, oracleAddress, chainId);
  const typeDescription = getOracleTypeDescription(oracleType);

  return (
    <>
      <div className="flex items-center justify-between pb-2">
        <span>Oracle Type:</span>
        {showLink ? (
          <Link
            href={getExplorerURL(oracleAddress, chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm font-medium no-underline hover:underline"
          >
            {typeDescription}
            <FiExternalLink className="ml-1 h-3 w-3" />
          </Link>
        ) : (
          <span className="text-sm font-medium">{typeDescription}</span>
        )}
      </div>

      {oracleType === OracleType.Standard ? (
        <MarketOracleFeedInfo
          baseFeedOne={oracleData?.baseFeedOne}
          baseFeedTwo={oracleData?.baseFeedTwo}
          quoteFeedOne={oracleData?.quoteFeedOne}
          quoteFeedTwo={oracleData?.quoteFeedTwo}
          chainId={chainId}
        />
      ) : showCustom ? (
        <div className="space-y-1">
          <div className="text-xs text-gray-600 dark:text-gray-400">{typeDescription}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            This market uses a custom oracle implementation that doesn't follow the standard feed structure.
          </div>
        </div>
      ) : null}
    </>
  );
}
