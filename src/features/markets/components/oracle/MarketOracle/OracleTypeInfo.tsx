import { InfoCircledIcon } from '@radix-ui/react-icons';
import { AddressIdentity } from '@/components/shared/address-identity';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { MarketOracleFeedInfo } from '@/features/markets/components/oracle';
import { Tooltip } from '@/components/ui/tooltip';
import { useOracleMetadata } from '@/hooks/useOracleMetadata';
import { getOracleType, getOracleTypeDescription, OracleType } from '@/utils/oracle';
import type { MorphoChainlinkOracleData } from '@/utils/types';
import { MetaOracleInfo } from './MetaOracleInfo';

type OracleTypeInfoProps = {
  oracleData: MorphoChainlinkOracleData | null | undefined;
  oracleAddress: string;
  chainId: number;
  showCustom?: boolean;
  useBadge?: boolean;
  variant?: 'summary' | 'detail';
};

export function OracleTypeInfo({ oracleData, oracleAddress, chainId, showCustom, useBadge, variant }: OracleTypeInfoProps) {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);
  const oracleType = getOracleType(oracleData, oracleAddress, chainId, oracleMetadataMap);
  const typeDescription = getOracleTypeDescription(oracleType);

  return (
    <>
      <div className={`flex items-center ${useBadge ? 'gap-1.5' : 'justify-between pb-2'}`}>
        <span className={useBadge ? 'text-xs text-secondary' : undefined}>
          {useBadge ? 'Type:' : 'Oracle:'}
        </span>
        <div className="flex items-center gap-1.5">
          <AddressIdentity
            address={oracleAddress}
            chainId={chainId}
            label={typeDescription}
          />
          {oracleType === OracleType.Meta && !useBadge && (
            <Tooltip content={
              <TooltipContent
                title="Meta Oracle"
                detail="Switches to a backup oracle if price deviation exceeds a threshold."
              />
            }>
              <InfoCircledIcon className="h-3.5 w-3.5 cursor-help text-secondary" />
            </Tooltip>
          )}
        </div>
      </div>

      {oracleType === OracleType.Standard ? (
        <MarketOracleFeedInfo
          baseFeedOne={oracleData?.baseFeedOne}
          baseFeedTwo={oracleData?.baseFeedTwo}
          quoteFeedOne={oracleData?.quoteFeedOne}
          quoteFeedTwo={oracleData?.quoteFeedTwo}
          chainId={chainId}
          oracleAddress={oracleAddress}
        />
      ) : oracleType === OracleType.Meta ? (
        <MetaOracleInfo
          oracleAddress={oracleAddress}
          chainId={chainId}
          variant={variant}
        />
      ) : showCustom ? (
        <div className="text-xs text-gray-500 dark:text-gray-500">
          This market uses a custom oracle implementation that doesn't follow the standard feed structure.
        </div>
      ) : null}
    </>
  );
}
