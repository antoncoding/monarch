import { useState } from 'react';
import { Input, Popover, PopoverTrigger, PopoverContent, Tooltip } from '@heroui/react';
import { ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { TooltipContent } from '@/components/TooltipContent';
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

  if (totalPages === 0) {
    return null;
  }

  const startEntry = (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalEntries);

  const handleJumpToPage = () => {
    const page = parseInt(jumpPage, 10);
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

  // Generate smart page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const delta = 1; // Number of pages to show on each side of current

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const start = Math.max(2, currentPage - delta);
      const end = Math.min(totalPages - 1, currentPage + delta);

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('ellipsis');
      }

      // Add pages around current
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
    <div className="mt-6 flex flex-col items-center justify-center gap-3">
      {/* Page controls */}
      <div className="flex items-center gap-1 rounded-md bg-surface p-1 shadow-sm">
        {/* Previous button */}
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage === 1 || isLoading}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-8 w-8"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-0.5">
          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className={cn(
                "flex h-8 items-center justify-center text-secondary",
                totalPages > 1000 ? 'w-10 text-xs' : 'w-8 text-sm'
              )}>
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
                  'h-8 transition-all duration-200',
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
          className="h-8 w-8"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>

        {/* Jump to page - only show if more than 10 pages */}
        {totalPages > 10 && (
          <div className="ml-1">
            <Popover isOpen={isJumpOpen} onOpenChange={setIsJumpOpen} placement="top">
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
                    className="h-8 w-8"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </Tooltip>
              <PopoverContent className="p-4">
                <div className="flex flex-col gap-2.5">
                  <p className="text-sm font-medium">Jump to page</p>
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
                      className="h-8"
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
        <div className="text-xs text-secondary">
          Showing {startEntry}-{endEntry} of {totalEntries} entries
        </div>
      )}
    </div>
  );
}
