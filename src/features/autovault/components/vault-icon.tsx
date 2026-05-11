'use client';

import Image from 'next/image';

type VaultIconProps = {
  imageSrc?: string;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
};

export function VaultIcon({ imageSrc, width = 24, height = 24, className = '', alt }: VaultIconProps) {
  const altText = alt ?? 'Vault logo';

  if (!imageSrc) {
    return (
      <div
        className={`rounded-full bg-gray-300 dark:bg-gray-700 ${className}`}
        style={{ width, height }}
      />
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full bg-surface ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <Image
        src={imageSrc}
        alt={altText}
        width={width}
        height={height}
        className="object-contain"
        unoptimized
      />
    </div>
  );
}
