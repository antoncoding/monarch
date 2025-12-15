import { useState, useMemo } from 'react';

type SortDirection = 'asc' | 'desc';

type SortFn<T> = (a: T, b: T) => number;

type UseTableSortProps<T> = {
  data: T[];
  sortFns: Record<string, SortFn<T>>;
  initialSortKey?: string;
  initialDirection?: SortDirection;
};

type UseTableSortReturn<T> = {
  sortKey: string;
  sortDirection: SortDirection;
  handleSort: (key: string) => void;
  sortedData: T[];
};

export function useTableSort<T>({
  data,
  sortFns,
  initialSortKey = '',
  initialDirection = 'desc',
}: UseTableSortProps<T>): UseTableSortReturn<T> {
  const [sortKey, setSortKey] = useState<string>(initialSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Toggle direction if clicking the same column
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // New column, default to descending
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortFns[sortKey]) {
      return data;
    }

    const sortFn = sortFns[sortKey];
    const sorted = [...data].sort(sortFn);

    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [data, sortKey, sortDirection, sortFns]);

  return {
    sortKey,
    sortDirection,
    handleSort,
    sortedData,
  };
}
