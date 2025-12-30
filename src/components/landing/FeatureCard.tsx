'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/utils';

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  href?: string;
  className?: string;
};

export function FeatureCard({ icon, title, description, href, className }: FeatureCardProps) {
  const content = (
    <div
      className={cn(
        'group p-5 h-full',
        // Grid-inspired border - all sides equal weight dashed
        'border border-dashed border-[var(--grid-cell-muted)]',
        'bg-surface',
        // Transition
        'transition-all duration-300 ease-in-out',
        // Hover: solid border
        'hover:border-solid hover:border-primary/30',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 text-primary/60 group-hover:text-primary transition-colors duration-300">{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-zen text-base font-medium text-primary mb-1.5">{title}</h3>
          <p className="text-sm text-secondary leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block no-underline"
      >
        {content}
      </Link>
    );
  }

  return content;
}
