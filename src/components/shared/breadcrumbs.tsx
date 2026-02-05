import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/utils/components';

type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
  isCurrent?: boolean;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav className={cn('flex items-center gap-2 text-sm text-secondary flex-nowrap overflow-x-auto leading-none py-1 font-zen', className)}>
      {items.map((item, index) => {
        const content = item.href ? (
          <Link
            href={item.href}
            className={cn('no-underline hover:no-underline text-secondary', item.isCurrent ? 'text-primary' : 'hover:text-primary')}
          >
            {item.label}
          </Link>
        ) : (
          <span className={cn(item.isCurrent ? 'text-primary' : 'text-secondary')}>{item.label}</span>
        );

        return (
          <span
            key={index}
            className="flex items-center gap-2"
          >
            {index > 0 && <span className="text-primary/60">/</span>}
            {content}
          </span>
        );
      })}
    </nav>
  );
}
