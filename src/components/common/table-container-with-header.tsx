type TableContainerWithHeaderProps = {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * Standard table container with header section.
 *
 * Provides consistent styling for tables with:
 * - Title on the left (uppercase, monospace font)
 * - Optional actions on the right (filters, refresh, settings, etc.)
 * - Separator border between header and content
 * - Responsive overflow handling
 *
 * @example
 * <TableContainerWithHeader
 *   title="Asset Activity"
 *   actions={
 *     <>
 *       <Button variant="ghost" size="sm">
 *         <RefreshIcon />
 *       </Button>
 *       <DropdownMenu>...</DropdownMenu>
 *     </>
 *   }
 * >
 *   <Table>...</Table>
 * </TableContainerWithHeader>
 */
export function TableContainerWithHeader({ title, actions, children, className = '' }: TableContainerWithHeaderProps) {
  return (
    <div className={`bg-surface rounded-md font-zen shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-0.5">
        <h3 className="font-monospace text-xs uppercase text-secondary">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
