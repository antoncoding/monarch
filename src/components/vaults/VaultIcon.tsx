'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { type VaultCurator, getVaultLogo } from '@/constants/vaults/known_vaults';

type VaultIconProps = {
  curator: VaultCurator | string;
  width?: number;
  height?: number;
  className?: string;
};

export function VaultIcon({ curator, width = 24, height = 24, className = '' }: VaultIconProps) {
  const logoSrc = useMemo(() => getVaultLogo(curator), [curator]);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full bg-surface ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <Image
        src={logoSrc}
        alt={`${curator} logo`}
        width={width}
        height={height}
        className="object-contain p-0.5"
      />
    </div>
  );
}
