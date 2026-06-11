import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/utils';

type SortDirection = 'asc' | 'desc';

type AdminSortableTableHeadProps<SortKey extends string> = {
  label: string;
  sortKeyValue: SortKey;
  currentSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
};

export function AdminSortableTableHead<SortKey extends string>({
  label,
  sortKeyValue,
  currentSortKey,
  sortDirection,
  onSort,
  align = 'left',
}: AdminSortableTableHeadProps<SortKey>) {
  const isSorted = currentSortKey === sortKeyValue;

  return (
    <TableHead
      className={cn('whitespace-nowrap font-normal', align === 'right' ? 'text-right' : 'text-left', isSorted && 'text-primary')}
      scope="col"
      aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={cn(
          'inline-flex w-full cursor-pointer items-center gap-1 font-normal transition-colors hover:text-primary',
          align === 'right' ? 'justify-end' : 'justify-start',
        )}
        onClick={() => onSort(sortKeyValue)}
      >
        <span>{label}</span>
        {isSorted && (sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />)}
      </button>
    </TableHead>
  );
}
