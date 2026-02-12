import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { LuArrowRight, LuLayers } from 'react-icons/lu';
import type { EnrichedVault } from '@/hooks/useOracleMetadata';
import { getTruncatedAssetName } from '@/utils/oracle';

type VaultEntryProps = {
  vault: EnrichedVault;
  chainId: number;
};

export function VaultEntry({ vault }: VaultEntryProps): JSX.Element {
  const baseAsset = getTruncatedAssetName(vault.pair?.[0] ?? 'Unknown');
  const quoteAsset = getTruncatedAssetName(vault.pair?.[1] ?? 'Unknown');

  return (
    <Tooltip
      content={
        <TooltipContent
          icon={<LuLayers size={16} />}
          title="Vault Conversion"
          detail={`${vault.symbol} → ${vault.assetSymbol}`}
          secondaryDetail={vault.address}
        />
      }
    >
      <div className="bg-hovered flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1 hover:bg-opacity-80 gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="max-w-[2.5rem] truncate whitespace-nowrap text-xs font-medium">{baseAsset}</span>
          <LuArrowRight
            className="flex-shrink-0 text-gray-500"
            size={10}
          />
          <span className="max-w-[2.5rem] truncate whitespace-nowrap text-xs font-medium">{quoteAsset}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <LuLayers
            size={12}
            className="flex-shrink-0 text-secondary"
          />
        </div>
      </div>
    </Tooltip>
  );
}
