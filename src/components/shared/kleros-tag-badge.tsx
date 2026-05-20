'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Tooltip } from '@/components/ui/tooltip';

const KLEROS_TAG_SOURCE_DETAIL = 'Source: Kleros Scout';
const KLEROS_BADGE_SRC = '/imgs/kleros-badge.svg';

type KlerosTagBadgeProps = {
  label: string;
  publicNote?: string;
  className?: string;
  labelClassName?: string;
};

function KlerosBadgeLogo({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border/70"
      style={{ height: size, width: size }}
    >
      <Image
        src={KLEROS_BADGE_SRC}
        alt=""
        width={size}
        height={size}
        className="h-full w-full rounded-full"
        unoptimized
      />
    </span>
  );
}

export function KlerosTagBadge({ label, publicNote, className, labelClassName }: KlerosTagBadgeProps) {
  return (
    <Tooltip
      content={
        <TooltipContent
          icon={<KlerosBadgeLogo size={18} />}
          detail={KLEROS_TAG_SOURCE_DETAIL}
          secondaryDetail={publicNote}
        />
      }
    >
      <span
        className={clsx('inline-flex min-w-0 items-center gap-1.5', className)}
        aria-label={`${label}, tagged by Kleros`}
      >
        <KlerosBadgeLogo />
        <span className={clsx('min-w-0 truncate', labelClassName)}>{label}</span>
      </span>
    </Tooltip>
  );
}
