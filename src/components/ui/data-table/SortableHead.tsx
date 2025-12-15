import * as React from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { TableHead } from '../table';

type SortableHeadProps = {
  label: string | React.ReactNode;
  sortKey: string;
  currentSortKey: string;
  direction: 'asc' | 'desc';
  onSort: (key: string) => void;
  showDirection?: boolean;
  className?: string;
};

export function SortableHead({
  label,
  sortKey,
  currentSortKey,
  direction,
  onSort,
  showDirection = true,
  className,
}: SortableHeadProps) {
  const isSorting = currentSortKey === sortKey;

  return (
    <TableHead
      className={`cursor-pointer select-none ${isSorting ? 'text-primary' : ''} ${className ?? ''}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
        <div>{label}</div>
        {showDirection && isSorting && (direction === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />)}
      </div>
    </TableHead>
  );
}
