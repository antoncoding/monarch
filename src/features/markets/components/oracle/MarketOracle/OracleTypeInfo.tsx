import { useMemo } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { AddressIdentity } from '@/components/shared/address-identity';
import { KlerosTagBadge } from '@/components/shared/kleros-tag-badge';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { MarketOracleFeedInfo } from '@/features/markets/components/oracle';
import { Tooltip } from '@/components/ui/tooltip';
import { formatKlerosAddressTagLabel, getKlerosAddressTagKey } from '@/data-sources/kleros/address-tags';
import { useOracleMetadata } from '@/hooks/useOracleMetadata';
import { useKlerosAddressTagsQuery } from '@/hooks/queries/useKlerosAddressTagsQuery';
import { getOracleType, getOracleTypeDescription, OracleType } from '@/utils/oracle';
import { MetaOracleInfo } from './MetaOracleInfo';

type OracleTypeInfoProps = {
  oracleAddress: string;
  chainId: number;
  showCustom?: boolean;
  useBadge?: boolean;
  variant?: 'summary' | 'detail';
};

export function OracleTypeInfo({ oracleAddress, chainId, showCustom, useBadge, variant }: OracleTypeInfoProps) {
  const { data: oracleMetadataMap } = useOracleMetadata(chainId);
  const oracleAddresses = useMemo(() => [oracleAddress], [oracleAddress]);
  const { data: klerosAddressTags } = useKlerosAddressTagsQuery(chainId, oracleAddresses);
  const oracleType = getOracleType(oracleAddress, chainId, oracleMetadataMap);
  const typeDescription = getOracleTypeDescription(oracleType);
  const klerosTag = klerosAddressTags?.[getKlerosAddressTagKey(chainId, oracleAddress)];
  const klerosLabel = formatKlerosAddressTagLabel(klerosTag);

  return (
    <>
      <div className={`flex items-center ${useBadge ? 'gap-1.5' : 'justify-between pb-2'}`}>
        <span className={useBadge ? 'text-xs text-secondary' : undefined}>{useBadge ? 'Type:' : 'Oracle:'}</span>
        <div className="flex items-center gap-1.5">
          <AddressIdentity
            address={oracleAddress}
            chainId={chainId}
            label={typeDescription}
          />
          {klerosLabel && (
            <span className="inline-flex max-w-[16rem] items-center rounded-sm bg-hovered px-2 py-1 font-zen text-xs text-secondary">
              <KlerosTagBadge
                label={klerosLabel}
                publicNote={klerosTag?.publicNote}
              />
            </span>
          )}
          {oracleType === OracleType.Meta && !useBadge && (
            <Tooltip
              content={
                <TooltipContent
                  title="Meta Oracle"
                  detail="Switches to a backup oracle if price deviation exceeds a threshold."
                />
              }
            >
              <InfoCircledIcon className="h-3.5 w-3.5 cursor-help text-secondary" />
            </Tooltip>
          )}
        </div>
      </div>

      {oracleType === OracleType.Standard ? (
        <MarketOracleFeedInfo
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
