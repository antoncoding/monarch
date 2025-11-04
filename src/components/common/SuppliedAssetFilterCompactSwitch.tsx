'use client';

import { VisuallyHidden, Tooltip, useSwitch } from '@heroui/react';
import { TbDropletQuestion } from 'react-icons/tb';

import { TooltipContent } from '@/components/TooltipContent';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';

type SuppliedAssetFilterCompactSwitchProps = {
  isEnabled: boolean;
  onToggle: (selected: boolean) => void;
  effectiveMinSupply: number;
  className?: string;
  ariaLabel?: string;
};

export function SuppliedAssetFilterCompactSwitch({
  isEnabled,
  onToggle,
  effectiveMinSupply,
  className,
  ariaLabel = 'Toggle liquidity filter',
}: SuppliedAssetFilterCompactSwitchProps) {
  const formattedThreshold = formatReadable(effectiveMinSupply);
  const containerClassName = ['flex items-center gap-2', className].filter(Boolean).join(' ');

  const tooltipDetail = isEnabled
    ? `Hiding markets below $${formattedThreshold} total supply`
    : `Showing all markets, toggle to hide markets below $${formattedThreshold} total supply.`;

  const { Component, slots, getInputProps, getWrapperProps } = useSwitch({
    isSelected: isEnabled,
    onValueChange: onToggle,
    'aria-label': ariaLabel,
  });

  const iconClassName = isEnabled ? 'text-primary' : 'text-secondary';

  return (
    <div className={containerClassName}>
      <Tooltip
        classNames={{
          base: 'p-0 m-0 bg-transparent shadow-sm border-none',
          content: 'p-0 m-0 bg-transparent shadow-sm border-none',
        }}
        content={
          <TooltipContent
            icon={<TbDropletQuestion size={14} />}
            title="Small Market Filter"
            detail={tooltipDetail}
            secondaryDetail="Configure threshold in settings modal"
          />
        }
      >
        <div>
          <Component>
            <VisuallyHidden>
              <input {...getInputProps()} />
            </VisuallyHidden>
            <div
              {...getWrapperProps()}
              className={slots.wrapper({
                class: [
                  'w-8 h-8',
                  'flex items-center justify-center',
                  'rounded-sm bg-hovered hover:bg-surface',
                  'cursor-pointer transition-colors',
                  'outline-none',
                  'data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-offset-2 data-[focus-visible=true]:ring-primary/40',
                  isEnabled ? 'text-monarch-orange' : ''
                ],
              })}
            >
              <TbDropletQuestion size={14} className={iconClassName} color={isEnabled ? MONARCH_PRIMARY : undefined}/>
            </div>
          </Component>
        </div>
      </Tooltip>
    </div>
  );
}
