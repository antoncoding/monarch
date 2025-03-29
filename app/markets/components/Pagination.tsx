import React from 'react';
import { Pagination as NextUIPagination } from '@nextui-org/react';

type PaginationProps = {
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  entriesPerPage: number;
  isDataLoaded: boolean;
};

export function Pagination({
  totalPages,
  currentPage,
  onPageChange,
  entriesPerPage,
  isDataLoaded,
}: PaginationProps) {
  if (!isDataLoaded || totalPages === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-center">
      <div className="flex items-center">
        <NextUIPagination
          key={`pagination-${isDataLoaded}-${totalPages}-${entriesPerPage}`}
          showControls
          total={totalPages}
          page={currentPage}
          initialPage={1}
          onChange={onPageChange}
          classNames={{
            wrapper: 'gap-0 overflow-visible h-8',
            item: 'w-8 h-8 text-small rounded-sm bg-transparent',
            cursor: 'bg-orange-500 text-white font-bold',
          }}
          size="md"
        />
      </div>
    </div>
  );
}
