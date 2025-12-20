import { Tooltip } from '@/components/ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { TooltipContent } from '@/components/shared/tooltip-content';

export function CollateralCapTooltip() {
  return (
    <Tooltip      content={
        <TooltipContent
          title="Collateral Caps"
          detail="Defines the maximum amount or percentage of an asset that can be allocated across all markets using the same collateral."
        />
      }
    >
      <InfoCircledIcon className="h-3 w-3 text-secondary" />
    </Tooltip>
  );
}

export function MarketCapTooltip() {
  return (
    <Tooltip      content={
        <TooltipContent
          title="Market Caps"
          detail="Defines the maximum amount or percentage of an asset that can be allocated to each individual market."
        />
      }
    >
      <InfoCircledIcon className="h-3 w-3 text-secondary" />
    </Tooltip>
  );
}
