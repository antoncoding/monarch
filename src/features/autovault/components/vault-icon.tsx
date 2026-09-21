'use client';

import Image from 'next/image';
import { useState } from 'react';
import { TokenIcon } from '@/components/shared/token-icon';
import type { MorphoVaultCurator } from '@/data-sources/morpho-api/vaults';

type VaultIconProps = {
  imageSrc?: string;
  asset?: { address: string; chainId: number };
  curator?: MorphoVaultCurator;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
};

const TRUSTED_VAULT_IMAGE_HOSTNAMES = new Set(['cdn.morpho.org']);

function getTrustedVaultImageSrc(imageSrc?: string) {
  if (!imageSrc) return undefined;

  try {
    const url = new URL(imageSrc);
    if (url.protocol !== 'https:' || !TRUSTED_VAULT_IMAGE_HOSTNAMES.has(url.hostname)) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function VaultIcon({ imageSrc, asset, curator, width = 24, height = 24, className = '', alt }: VaultIconProps) {
  const [failedCuratorImage, setFailedCuratorImage] = useState<string | null>(null);
  const altText = alt ?? 'Vault logo';
  const trustedImageSrc = getTrustedVaultImageSrc(imageSrc);
  const curatorImageSrc = getTrustedVaultImageSrc(curator?.image);

  if (!trustedImageSrc && asset) {
    const curatorSize = Math.round(Math.min(width, height) * 0.6);

    return (
      <div
        className={`relative shrink-0 ${className}`}
        style={{ width, height }}
      >
        <TokenIcon
          address={asset.address}
          chainId={asset.chainId}
          width={width}
          height={height}
          disableTooltip
        />
        {curator && curatorImageSrc && curatorImageSrc !== failedCuratorImage && (
          <span
            className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface ring-2 ring-surface"
            title={`Curated by ${curator.name}`}
          >
            <Image
              src={curatorImageSrc}
              alt={`${curator.name} curator logo`}
              width={curatorSize}
              height={curatorSize}
              className="rounded-full object-contain"
              unoptimized
              onError={() => setFailedCuratorImage(curatorImageSrc)}
            />
          </span>
        )}
      </div>
    );
  }

  if (!trustedImageSrc) {
    return (
      <div
        aria-label={altText}
        className={`rounded-full bg-gray-300 dark:bg-gray-700 ${className}`}
        role="img"
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
        src={trustedImageSrc}
        alt={altText}
        width={width}
        height={height}
        className="object-contain"
        unoptimized
      />
    </div>
  );
}
