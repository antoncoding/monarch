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
  console.log('no padding markets');

  return (
    <div className={`bg-surface rounded-md font-zen shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-0.5">
        <h3 className="font-monospace text-xs uppercase text-secondary">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="overflow-x-auto pb-4">{children}</div>
    </div>
  );
}

type TableContainerWithDescriptionProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * Expanded table container variant with description support.
 *
 * Features:
 * - Larger title with primary color (not secondary)
 * - Description text below title
 * - More vertical padding in header
 * - Actions are vertically centered
 *
 * @example
 * <TableContainerWithDescription
 *   title="Active Allocations"
 *   description="See where your assets are deployed"
 *   actions={<IconSwitch />}
 * >
 *   <Table>...</Table>
 * </TableContainerWithDescription>
 */
export function TableContainerWithDescription({
  title,
  description,
  actions,
  children,
  className = '',
}: TableContainerWithDescriptionProps) {
  return (
    <div className={`bg-surface rounded-md font-zen shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium mb-1">{title}</h3>
          <p className="text-xs text-secondary">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2 ml-4">{actions}</div>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
