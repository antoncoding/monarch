import type * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TableRow, TableCell } from '../table';

type ExpandableRowProps = {
  isExpanded: boolean;
  colSpan: number;
  children: React.ReactNode;
  className?: string;
};

/**
 * ExpandableRow component for animated row expansion in tables.
 *
 * Usage:
 * ```tsx
 * <TableBody>
 *   {items.map((item) => (
 *     <React.Fragment key={item.id}>
 *       <TableRow onClick={() => toggleExpanded(item.id)}>
 *         ... main row content ...
 *       </TableRow>
 *       <ExpandableRow
 *         isExpanded={expandedId === item.id}
 *         colSpan={columnCount}
 *       >
 *         ... expanded content ...
 *       </ExpandableRow>
 *     </React.Fragment>
 *   ))}
 * </TableBody>
 * ```
 */
export function ExpandableRow({ isExpanded, colSpan, children, className }: ExpandableRowProps) {
  return (
    <AnimatePresence>
      {isExpanded && (
        <TableRow className={className}>
          <TableCell
            colSpan={colSpan}
            className="bg-[var(--palette-bg-hovered)] p-0"
          >
            <motion.div
              key="content"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.1 }}
              className="overflow-hidden"
            >
              <div className="p-4">{children}</div>
            </motion.div>
          </TableCell>
        </TableRow>
      )}
    </AnimatePresence>
  );
}
