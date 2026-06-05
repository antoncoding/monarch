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
 * - Compact utility header that sits close to the table content
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
    <div className={`rounded border border-border bg-surface font-zen shadow-sm ${className}`}>
      <div className="flex min-h-9 items-center justify-between px-4 pt-2 pb-0">
        <h3 className="font-monospace text-[11px] uppercase leading-4 tracking-[0.08em] text-secondary">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="overflow-x-auto pb-2">{children}</div>
    </div>
  );
}

type TableContainerWithDescriptionProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * Expanded table container variant with description support.
 *
 * Features:
 * - Description text below title
 * - Compact utility header that matches standard table containers
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
    <div className={`rounded border border-border bg-surface font-zen shadow-sm ${className}`}>
      <div className="flex min-h-10 items-start justify-between gap-4 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-monospace text-[11px] uppercase leading-4 tracking-[0.08em] text-secondary">{title}</h3>
          {description && <p className="mt-1 text-xs leading-4 text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="overflow-x-auto pb-2">{children}</div>
    </div>
  );
}
