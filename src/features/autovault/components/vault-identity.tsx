'use client';

import { useMemo, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { AddressIdentity } from '@/components/shared/address-identity';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { getVaultURL, supportsMorphoAppLinks } from '@/utils/external';
import { VaultIcon } from './vault-icon';

type VaultIdentityVariant = 'chip' | 'inline' | 'icon';

type VaultIdentityProps = {
  address: `0x${string}`;
  asset?: `0x${string}`;
  chainId: number;
  vaultName?: string;
  imageSrc?: string;
  description?: string;
  showLink?: boolean;
  variant?: VaultIdentityVariant;
  showTooltip?: boolean;
  iconSize?: number;
  className?: string;
  tooltipDetail?: ReactNode;
  tooltipSecondaryDetail?: ReactNode;
  showAddressInTooltip?: boolean;
};

export function VaultIdentity({
  address,
  asset,
  chainId,
  vaultName,
  imageSrc,
  description,
  showLink = true,
  variant = 'chip',
  showTooltip = true,
  iconSize = 20,
  className = '',
  tooltipDetail,
  tooltipSecondaryDetail,
  showAddressInTooltip = true,
}: VaultIdentityProps) {
  const vaultHref = useMemo(() => getVaultURL(address, chainId), [address, chainId]);
  const canLinkToMorpho = useMemo(() => supportsMorphoAppLinks(chainId), [chainId]);
  const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const displayName = vaultName ?? formattedAddress;
  const iconAlt = `${displayName} logo`;

  const renderIcon = (size: number) => {
    return (
      <VaultIcon
        imageSrc={imageSrc}
        width={size}
        height={size}
        alt={iconAlt}
      />
    );
  };

  const baseContent = (() => {
    if (variant === 'icon') {
      return <div className={`inline-flex items-center ${className}`}>{renderIcon(iconSize)}</div>;
    }

    if (variant === 'inline') {
      return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
          {renderIcon(iconSize)}
          <div className="flex flex-col leading-tight font-zen">
            <span className="text-sm text-primary">{displayName}</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`inline-flex items-center gap-2 rounded bg-hovered px-2 py-1 text-xs text-secondary ${className}`}>
        {renderIcon(iconSize)}
        <div className="flex flex-col leading-tight">
          <span className="text-primary">{displayName}</span>
          <span className="font-monospace text-[10px]">{formattedAddress}</span>
        </div>
      </div>
    );
  })();

  const interactiveContent =
    showLink && canLinkToMorpho ? (
      <Link
        href={vaultHref}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline"
        onClick={(e) => e.stopPropagation()}
      >
        {baseContent}
      </Link>
    ) : (
      baseContent
    );

  if (!showTooltip) {
    return interactiveContent;
  }

  const defaultDetail = showAddressInTooltip ? (
    <AddressIdentity
      address={address}
      chainId={chainId}
      label="Vault"
    />
  ) : undefined;
  const resolvedDetail = tooltipDetail ?? defaultDetail;
  const resolvedSecondaryDetail = tooltipSecondaryDetail ?? description;

  const tooltipTitle = (
    <div className="flex items-center gap-2">
      <span>{displayName}</span>
      {asset && (
        <TokenIcon
          address={asset}
          chainId={chainId}
          width={18}
          height={18}
          disableTooltip
        />
      )}
    </div>
  );

  return (
    <Tooltip
      content={
        <TooltipContent
          icon={renderIcon(32)}
          title={tooltipTitle}
          detail={resolvedDetail}
          secondaryDetail={resolvedSecondaryDetail}
          actionIcon={<ExternalLinkIcon className="h-4 w-4" />}
          actionHref={vaultHref}
          onActionClick={(e) => e.stopPropagation()}
        />
      }
    >
      {interactiveContent}
    </Tooltip>
  );
}
