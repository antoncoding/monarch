import { MdVerified } from 'react-icons/md';
import { cn } from '@/utils/components';

export function MonarchVerifiedIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <MdVerified
      size={size}
      className={cn('shrink-0 text-[var(--color-primary)]', className)}
      aria-hidden="true"
    />
  );
}
