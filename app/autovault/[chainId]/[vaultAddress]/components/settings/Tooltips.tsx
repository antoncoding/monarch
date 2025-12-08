import { Tooltip } from '@heroui/react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { TooltipContent } from '@/components/TooltipContent';

export function CollateralCapTooltip() {
  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
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
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
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
