import { useState, useEffect } from 'react';
import { Input, Popover, PopoverTrigger, PopoverContent, Tooltip } from '@heroui/react';
import { ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalEntries: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  showEntryCount?: boolean;
};

export function TablePagination({
  currentPage,
  totalPages,
  totalEntries,
  pageSize,
  onPageChange,
  isLoading = false,
  showEntryCount = true,
}: TablePaginationProps) {
  const [jumpPage, setJumpPage] = useState('');
  const [isJumpOpen, setIsJumpOpen] = useState(false);

  // Track the visible window of page numbers to keep pagination stable
  const [visibleWindow, setVisibleWindow] = useState(() => {
    const windowSize = 3;
    const start = Math.max(2, Math.min(currentPage - 1, totalPages - windowSize));
    const end = Math.min(totalPages - 1, start + windowSize - 1);
    return { start, end };
  });

  // Update visible window only when necessary (when current page goes outside window)
  useEffect(() => {
    if (totalPages <= 7) return; // Show all pages, no windowing needed

    const windowSize = 3; // Number of middle pages to show
    const { start, end } = visibleWindow;

    // Only slide the window if current page goes OUTSIDE the visible range
    if (currentPage >= 2 && currentPage <= totalPages - 1) {
      let newStart = start;
      let newEnd = end;

      // Current page is before the window - slide left to include it
      if (currentPage < start) {
        newStart = Math.max(2, currentPage);
        newEnd = Math.min(totalPages - 1, newStart + windowSize - 1);
        newStart = Math.max(2, newEnd - windowSize + 1);
      }
      // Current page is after the window - slide right to include it
      else if (currentPage > end) {
        newEnd = Math.min(totalPages - 1, currentPage);
        newStart = Math.max(2, newEnd - windowSize + 1);
      }

      if (newStart !== start || newEnd !== end) {
        setVisibleWindow({ start: newStart, end: newEnd });
      }
    }
  }, [currentPage, totalPages, visibleWindow]);

  // Early return after all hooks
  if (totalPages === 0) {
    return null;
  }

  const startEntry = (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalEntries);

  const handleJumpToPage = () => {
    const page = Number.parseInt(jumpPage, 10);
    if (page >= 1 && page <= totalPages) {
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

  // Generate smart page numbers with ellipsis using stable window
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Use the stable visible window
      const { start, end } = visibleWindow;

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('ellipsis');
      }

      // Add pages in the visible window
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

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
                key={`ellipsis-${idx}`}
                className={cn(
                  'flex h-8 items-center justify-center text-secondary font-zen !font-normal',
                  totalPages > 1000 ? 'w-10 text-xs' : 'w-8 text-sm',
                )}
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'ghost'}
                size="icon"
                onClick={() => onPageChange(page)}
                disabled={isLoading}
                className={cn(
                  'h-8 transition-all duration-200 font-zen !font-normal',
                  totalPages > 1000 ? 'w-10 text-xs' : 'w-8 text-sm',
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
          disabled={currentPage === totalPages || isLoading}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-8 w-8 font-zen !font-normal"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>

        {/* Jump to page - only show if more than 10 pages */}
        {totalPages > 10 && (
          <div className="ml-1">
            <Popover
              isOpen={isJumpOpen}
              onOpenChange={setIsJumpOpen}
              placement="top"
            >
              <Tooltip
                classNames={{
                  base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                  content: 'p-0 m-0 bg-transparent shadow-sm border-none',
                }}
                content={
                  <TooltipContent
                    title="Jump to page"
                    detail={`Go to a specific page (1-${totalPages})`}
                    icon={<MagnifyingGlassIcon />}
                  />
                }
              >
                <PopoverTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isLoading}
                    className="h-8 w-8 font-zen !font-normal"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
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
                      max={totalPages}
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
