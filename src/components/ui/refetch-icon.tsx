'use client';

import { useEffect, useRef, useState } from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { cn } from '@/utils';

type RefetchIconProps = {
  isLoading: boolean;
  className?: string;
};

export function RefetchIcon({ isLoading, className }: RefetchIconProps) {
  const [isSpinning, setIsSpinning] = useState(isLoading);
  const iconRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (isLoading) {
      setIsSpinning(true);
      return;
    }

    // When loading stops, wait for animation to complete current rotation
    const icon = iconRef.current;
    if (!icon || !isSpinning) return;

    const handleAnimationIteration = () => {
      setIsSpinning(false);
    };

    icon.addEventListener('animationiteration', handleAnimationIteration);
    return () => icon.removeEventListener('animationiteration', handleAnimationIteration);
  }, [isLoading, isSpinning]);

  return (
    <ReloadIcon
      ref={iconRef}
      className={cn('h-3 w-3', isSpinning && 'animate-spin', className)}
    />
  );
}
