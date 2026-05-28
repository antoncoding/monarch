import { CheckIcon, GearIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { cn } from '@/utils/components';

type PeriodOption = {
  value: EarningsPeriod;
  label: string;
  shortLabel: string;
};

export const POSITIONS_PERIOD_OPTIONS: readonly PeriodOption[] = [
  { value: 'day', label: '24 hours', shortLabel: '24H' },
  { value: 'week', label: '7 days', shortLabel: '7D' },
  { value: 'month', label: '30 days', shortLabel: '30D' },
  { value: 'threemonth', label: '3 months', shortLabel: '3M' },
  { value: 'sixmonth', label: '6 months', shortLabel: '6M' },
  { value: 'all', label: 'All time', shortLabel: 'All' },
];

export const getPositionsPeriodLabel = (period: EarningsPeriod): string =>
  POSITIONS_PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? period;

export const getPositionsPeriodShortLabel = (period: EarningsPeriod): string =>
  POSITIONS_PERIOD_OPTIONS.find((option) => option.value === period)?.shortLabel ?? period;

type PositionsPeriodSettingsButtonProps = {
  period: EarningsPeriod;
  onPeriodChange: (period: EarningsPeriod) => void;
  className?: string;
};

export function PositionsPeriodSettingsButton({ period, onPeriodChange, className }: PositionsPeriodSettingsButtonProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const selectedLabel = getPositionsPeriodLabel(period);

  return (
    <>
      <Tooltip
        content={
          <TooltipContent
            title="Analytics period"
            detail={`Currently ${selectedLabel}. Applies to portfolio, Market Supplies, and Auto Vaults.`}
          />
        }
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn('text-secondary', className)}
          onClick={onOpen}
          aria-label={`Analytics period settings, currently ${selectedLabel}`}
        >
          <GearIcon className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="md"
        backdrop="opaque"
        zIndex="settings"
      >
        {(close) => (
          <>
            <ModalHeader
              variant="compact"
              title="Portfolio Settings"
              description="Analytics period applies across portfolio APY, Market Supplies, and Auto Vault earnings."
              mainIcon={<GearIcon />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="gap-3"
            >
              <div
                role="radiogroup"
                aria-label="Analytics period"
                className="grid grid-cols-2 gap-2"
              >
                {POSITIONS_PERIOD_OPTIONS.map((option) => {
                  const selected = option.value === period;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onPeriodChange(option.value)}
                      className={cn(
                        'flex items-center justify-between rounded-sm border px-3 py-2 text-left transition-colors',
                        selected
                          ? 'border-[var(--palette-orange)] bg-hovered text-primary'
                          : 'border-border text-secondary hover:bg-hovered',
                      )}
                    >
                      <span className="text-sm">{option.label}</span>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-sm text-xs">
                        {selected ? <CheckIcon className="h-3.5 w-3.5 text-[var(--palette-orange)]" /> : option.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </ModalBody>
            <ModalFooter className="justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={close}
              >
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}
