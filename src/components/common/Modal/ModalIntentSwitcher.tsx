import { ChevronDownIcon } from '@radix-ui/react-icons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/components';

type ModalIntentOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ModalIntentSwitcherProps = {
  value: string;
  options: ModalIntentOption[];
  onValueChange: (value: string) => void;
  className?: string;
};

export function ModalIntentSwitcher({ value, options, onValueChange, className }: ModalIntentSwitcherProps): JSX.Element {
  const selected = options.find((option) => option.value === value) ?? options[0];
  const canSwitch = options.length > 1;

  if (!selected) {
    return <span className={className}>-</span>;
  }

  if (!canSwitch) {
    return <span className={className}>{selected.label}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-hovered focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60',
            className,
          )}
        >
          <span>{selected.label}</span>
          <ChevronDownIcon className="h-4 w-4 text-secondary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-[3600] min-w-[11rem] p-1"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(value === option.value && 'bg-hovered')}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
