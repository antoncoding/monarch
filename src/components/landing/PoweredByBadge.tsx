'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { cn } from '@/utils';
import morphoLogoDark from '@/imgs/intro/morpho-logo-darkmode.svg';
import morphoLogoLight from '@/imgs/intro/morpho-logo-lightmode.svg';

type PoweredByBadgeProps = {
  className?: string;
};

export function PoweredByBadge({ className }: PoweredByBadgeProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5',
          'bg-surface/50 border border-border rounded-full',
          'text-base text-secondary',
          className,
        )}
      >
        <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
        <span className="font-zen">Powered by Morpho</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5',
        'bg-surface/50 border border-border rounded-full',
        'text-sm text-secondary',
        'transition-colors hover:border-primary/30',
        className,
      )}
    >
      <Image
        src={theme === 'dark' ? morphoLogoDark : morphoLogoLight}
        alt="Morpho"
        width={16}
        height={16}
        className="h-4 w-4"
      />
      <span className="font-zen">Powered by Morpho</span>
    </div>
  );
}
