import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { FiSearch } from 'react-icons/fi';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils';

type TablePaginationBaseProps = {
  currentPage: number;
  totalEntries: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  showEntryCount?: boolean;
};

type FixedPaginationProps = {
  mode: 'fixed';
  totalPages: number;
};

type OpenPaginationProps = {
  mode: 'open';
  hasNextPage: boolean;
};

type TablePaginationProps = TablePaginationBaseProps & (FixedPaginationProps | OpenPaginationProps);

type PaginationToken = number | 'ellipsis';

export function TablePagination({
  currentPage,
  totalEntries,
  pageSize,
  onPageChange,
  isLoading = false,
  showEntryCount = true,
  ...paginationProps
}: TablePaginationProps) {
  const [jumpPage, setJumpPage] = useState('');
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const isOpenEnded = paginationProps.mode === 'open';
  const hasNextPage = isOpenEnded ? (paginationProps.hasNextPage ?? false) : false;
  const effectiveTotalPages = isOpenEnded ? currentPage + Number(hasNextPage) : paginationProps.totalPages;

  // Early return after all hooks
  if (isOpenEnded && currentPage === 1 && !hasNextPage && totalEntries === 0) {
    return null;
  }

  if (effectiveTotalPages === 0) {
    return null;
  }

  const startEntry = (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalEntries);

  const handleJumpToPage = () => {
    const page = Number.parseInt(jumpPage, 10);
    if (page >= 1 && page <= effectiveTotalPages) {
      onPageChange(page);
      setJumpPage('');
      setIsJumpOpen(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  // Generate fixed-length page numbers to keep controls spatially stable.
  const getPageNumbers = (): PaginationToken[] => {
    if (isOpenEnded) {
      const pages: PaginationToken[] = [];

      if (currentPage > 1) {
        pages.push(currentPage - 1);
      }

      pages.push(currentPage);

      if (hasNextPage) {
        pages.push(currentPage + 1);
      }

      return pages;
    }

    const pages: PaginationToken[] = [];

    if (effectiveTotalPages <= 7) {
      for (let i = 1; i <= effectiveTotalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', effectiveTotalPages];
    }

    if (currentPage >= effectiveTotalPages - 3) {
      return [
        1,
        'ellipsis',
        effectiveTotalPages - 4,
        effectiveTotalPages - 3,
        effectiveTotalPages - 2,
        effectiveTotalPages - 1,
        effectiveTotalPages,
      ];
    }

    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', effectiveTotalPages];
  };

  const getItemKey = (page: PaginationToken, idx: number) => {
    if (page === 'ellipsis') {
      return `ellipsis-${idx}`;
    }
    return `page-${page}`;
  };

  const pageNumbers = getPageNumbers();

  const paginationControlWidthClass = effectiveTotalPages > 1000 ? 'w-10 text-xs' : 'w-8 text-sm';

  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-3 font-zen">
      {/* Page controls */}
      <div className="flex items-center gap-1 rounded-md bg-surface p-1 shadow-sm">
        {/* Previous button */}
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage === 1 || isLoading}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8 w-8 font-zen !font-normal"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-0.5">
          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <span
                key={getItemKey(page, idx)}
                className={cn('flex h-8 items-center justify-center text-secondary font-zen !font-normal', paginationControlWidthClass)}
              >
                ...
              </span>
            ) : (
              <Button
                key={getItemKey(page, idx)}
                variant={currentPage === page ? 'default' : 'ghost'}
                size="icon"
                onClick={() => onPageChange(page)}
                disabled={isLoading}
                className={cn(
                  'h-8 transition-all duration-200 font-zen !font-normal',
                  paginationControlWidthClass,
                  currentPage === page && 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {page}
              </Button>
            ),
          )}
        </div>

        {/* Next button */}
        <Button
          variant="ghost"
          size="icon"
          disabled={(isOpenEnded ? !hasNextPage : currentPage === effectiveTotalPages) || isLoading}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8 w-8 font-zen !font-normal"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>

        {/* Jump to page - only show if more than 10 pages */}
        {!isOpenEnded && effectiveTotalPages > 10 && (
          <div className="ml-1">
            <Popover
              open={isJumpOpen}
              onOpenChange={setIsJumpOpen}
            >
              <Tooltip
                content={
                  <TooltipContent
                    title="Jump to page"
                    detail={`Go to a specific page (1-${effectiveTotalPages})`}
                    icon={<FiSearch />}
                  />
                }
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isLoading}
                    className="h-8 w-8 font-zen !font-normal"
                  >
                    <FiSearch className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </Tooltip>
              <PopoverContent className="p-4">
                <div className="flex flex-col gap-2.5 font-zen">
                  <p className="text-sm !font-normal">Jump to page</p>
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      size="sm"
                      type="number"
                      min={1}
                      max={effectiveTotalPages}
                      value={jumpPage}
                      onChange={(e) => setJumpPage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-24"
                      classNames={{
                        input: 'text-center rounded-sm px-3',
                        inputWrapper: 'rounded-sm',
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleJumpToPage}
                      disabled={!jumpPage}
                      className="h-8 font-zen !font-normal"
                    >
                      Go
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Entry count - below controls */}
      {showEntryCount && (
        <div className="text-xs text-secondary font-zen !font-normal">
          Showing {startEntry}-{endEntry} of {totalEntries} entries
        </div>
      )}
    </div>
  );
}
