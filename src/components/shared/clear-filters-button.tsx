import { TrashIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';

type ClearFiltersButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function ClearFiltersButton({ onClick, disabled }: ClearFiltersButtonProps) {
  return (
    <Button
      variant="default"
      size="md"
      onClick={onClick}
      disabled={disabled}
      className="w-10 min-w-10 px-0"
      aria-label="Clear all filters"
    >
      <TrashIcon />
    </Button>
  );
}
