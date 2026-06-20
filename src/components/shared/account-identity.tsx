'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { FaCircle } from 'react-icons/fa';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { LuCopy, LuLink } from 'react-icons/lu';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import { useConnection, useEnsName } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { AccountActionsPopover } from '@/components/shared/account-actions-popover';
import { KlerosTagBadge } from '@/components/shared/kleros-tag-badge';
import { Name } from '@/components/shared/name';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Tooltip } from '@/components/ui/tooltip';
import { formatKlerosAddressTagLabel, type KlerosAddressTag } from '@/data-sources/kleros/address-tags';
import { useAddressLabel } from '@/hooks/useAddressLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import type { VaultAccountIdentity } from '@/contexts/VaultRegistryContext';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import { formatVaultAdapterType, getMonarchVaultHref } from '@/utils/vaults';
import type { Address } from 'viem';

const ACCOUNT_IDENTITY_LABEL_MAX_WIDTH_CLASS = 'max-w-[22rem]';
const FULL_ACCOUNT_CHIP_CLASS = 'inline-flex h-7 items-center rounded-sm px-2 text-xs leading-none';
const FULL_ACCOUNT_ICON_BUTTON_CLASS = 'inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors';

type AccountIdentityProps = {
  address: Address;
  chainId?: number;
  variant?: 'badge' | 'compact' | 'full';
  linkTo?: 'explorer' | 'profile' | 'none';
  copyable?: boolean;
  showCopy?: boolean;
  showAddress?: boolean;
  showActions?: boolean;
  showAdapterBadge?: boolean;
  showBookmark?: boolean;
  // AccountIdentity does not fetch Kleros data; list views should batch visible addresses and pass the matching tag.
  klerosTag?: KlerosAddressTag | null;
  className?: string;
};

type MainTagKind = 'adapter' | 'ens' | 'kleros' | 'vault';

const getMainTagClassName = (kind: MainTagKind) =>
  clsx(FULL_ACCOUNT_CHIP_CLASS, 'min-w-0 font-zen text-secondary', kind === 'adapter' ? 'border border-border bg-surface' : 'bg-hovered');

const getEntityBadgeLabel = (vaultIdentity: VaultAccountIdentity): string | undefined => {
  if (vaultIdentity.kind === 'vault-adapter') {
    return undefined;
  }

  if (vaultIdentity.kind === 'vault-v2') {
    return 'Vault V2';
  }

  return 'Vault';
};

/**
 * Unified component for displaying account identities across the app.
 *
 * Badge & Compact: Show vault name → Kleros tag → ENS name → shortened address
 * Full: Always show address badge + optional extra badges (connected, ENS, vault, Kleros)
 *
 * Variants:
 * - badge: Minimal inline badge (no avatar)
 * - compact: Avatar (16px) wrapped in badge background
 * - full: Avatar (36px) + address badge + extra badges (all centered on one line)
 */
export function AccountIdentity({
  address,
  chainId,
  variant = 'badge',
  linkTo = 'none',
  copyable = false,
  showCopy = false,
  showAddress = false,
  showActions = true,
  showAdapterBadge = false,
  showBookmark = false,
  klerosTag,
  className,
}: AccountIdentityProps) {
  const { address: connectedAddress, isConnected } = useConnection();
  const [mounted, setMounted] = useState(false);
  const [metadataImageFailed, setMetadataImageFailed] = useState(false);
  const toast = useStyledToast();
  const { toggleAddressBookmark, isAddressBookmarked } = usePortfolioBookmarks();
  const { vaultName, vaultIdentity, shortAddress } = useAddressLabel(address, chainId);
  const { data: ensName } = useEnsName({
    address: address as `0x${string}`,
    chainId: 1,
  });
  const isVaultV2Identity = vaultIdentity?.kind === 'vault-v2';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMetadataImageFailed(false);
  }, [vaultIdentity?.metadataImage]);

  const isOwner = useMemo(() => {
    return mounted && isConnected && address === connectedAddress;
  }, [address, connectedAddress, isConnected, mounted]);

  const href = useMemo(() => {
    // When showActions is enabled, don't use linkTo - popover handles navigation
    if (showActions) return null;

    if (linkTo === 'none') return null;
    if (linkTo === 'explorer') {
      return getExplorerURL(
        address as `0x${string}`,
        (chainId ?? vaultIdentity?.chainId ?? SupportedNetworks.Mainnet) as SupportedNetworks,
      );
    }
    if (linkTo === 'profile') {
      if (isVaultV2Identity) {
        return getMonarchVaultHref(vaultIdentity.chainId, vaultIdentity.vaultAddress);
      }
      return `/positions/${address}`;
    }
    return null;
  }, [linkTo, address, showActions, chainId, isVaultV2Identity, vaultIdentity?.chainId, vaultIdentity?.vaultAddress]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, toast]);

  const labelClasses = clsx('min-w-0 truncate', ACCOUNT_IDENTITY_LABEL_MAX_WIDTH_CLASS);
  // Kleros name tag for contracts, only used when not official vaults.
  const klerosLabel = vaultName ? undefined : formatKlerosAddressTagLabel(klerosTag);
  const klerosTitle = klerosLabel ? [klerosLabel, klerosTag?.publicNote].filter(Boolean).join('\n') : undefined;
  const primaryLabel = vaultName ?? klerosLabel;
  const primaryLabelTitle = vaultName ?? klerosTitle;
  const adapterTypeLabel = vaultIdentity?.kind === 'vault-adapter' ? formatVaultAdapterType(vaultIdentity.adapterType) : undefined;
  const mainTag = vaultIdentity
    ? {
        kind: vaultIdentity.kind === 'vault-adapter' ? ('adapter' as const) : ('vault' as const),
        label: adapterTypeLabel ?? vaultIdentity.displayName,
        title: adapterTypeLabel ?? vaultIdentity.displayName,
      }
    : klerosLabel
      ? { kind: 'kleros' as const, label: klerosLabel, title: klerosTitle ?? klerosLabel }
      : showAddress && ensName
        ? { kind: 'ens' as const, label: ensName, title: ensName }
        : undefined;
  const entityBadge = vaultIdentity ? getEntityBadgeLabel(vaultIdentity) : undefined;
  const metadataImageUrl = vaultIdentity?.metadataImage && !metadataImageFailed ? vaultIdentity.metadataImage : undefined;
  const adapterBadge =
    showAdapterBadge && vaultIdentity?.kind === 'vault-adapter' ? (
      <span className="inline-flex shrink-0 items-center rounded-sm bg-surface px-1.5 py-0.5 font-zen text-[10px] uppercase tracking-[0.08em] text-secondary">
        Adapter
      </span>
    ) : null;
  const linkedVaultHref =
    vaultIdentity?.kind === 'vault-adapter' && vaultIdentity.vaultAddress.toLowerCase() !== address.toLowerCase()
      ? getMonarchVaultHref(vaultIdentity.chainId, vaultIdentity.vaultAddress)
      : undefined;
  const actionsProfileHref = isVaultV2Identity
    ? getMonarchVaultHref(vaultIdentity.chainId, vaultIdentity.vaultAddress)
    : `/positions/${address}`;
  const actionsProfileLabel = isVaultV2Identity ? 'View Vault' : 'View Portfolio';
  const actionLinks = useMemo(() => {
    const links: { href: string; label: string }[] = [];

    if (linkedVaultHref) {
      links.push({ href: linkedVaultHref, label: 'View Vault' });
    }

    if (klerosLabel && klerosTag?.dataOriginLink) {
      links.push({ href: klerosTag.dataOriginLink, label: 'View Tag Source' });
    }

    return links;
  }, [klerosLabel, klerosTag?.dataOriginLink, linkedVaultHref]);

  // Badge variant - minimal inline badge (no avatar)
  if (variant === 'badge') {
    const content = (
      <>
        {klerosLabel ? (
          <KlerosTagBadge
            label={klerosLabel}
            publicNote={klerosTag?.publicNote}
            labelClassName={clsx('font-zen', labelClasses)}
          />
        ) : primaryLabel ? (
          <span
            className={clsx('font-zen', labelClasses)}
            title={primaryLabelTitle}
          >
            {primaryLabel}
          </span>
        ) : (
          <Name
            address={address as `0x${string}`}
            className={labelClasses}
          />
        )}
        {linkTo === 'explorer' && <ExternalLinkIcon className="h-3 w-3" />}
        {showCopy && (
          <LuCopy
            className="h-3 w-3 cursor-pointer transition-colors hover:text-primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleCopy();
            }}
          />
        )}
      </>
    );

    const badgeClasses = clsx(
      'inline-flex items-center gap-1 rounded-sm bg-hovered px-2 py-1 text-xs text-secondary',
      copyable && 'cursor-pointer transition-colors hover:brightness-110',
      href && 'no-underline transition-colors hover:bg-gray-300 hover:text-primary hover:no-underline dark:hover:bg-gray-700',
      className,
    );

    const badgeElement = href ? (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Link
          href={href}
          target={linkTo === 'explorer' ? '_blank' : undefined}
          rel={linkTo === 'explorer' ? 'noopener noreferrer' : undefined}
          className={badgeClasses}
          onClick={(e) => {
            if (copyable) {
              e.preventDefault();
              void handleCopy();
            } else if (linkTo === 'explorer') {
              e.stopPropagation();
            }
          }}
        >
          {content}
        </Link>
      </motion.div>
    ) : (
      <motion.div
        className={badgeClasses}
        onClick={copyable ? () => void handleCopy() : undefined}
        style={{ cursor: copyable ? 'pointer' : 'default' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {content}
      </motion.div>
    );

    if (showActions) {
      return (
        <AccountActionsPopover
          address={address}
          chainId={chainId ?? vaultIdentity?.chainId}
          extraLinks={actionLinks}
          profileHref={actionsProfileHref}
          profileLabel={actionsProfileLabel}
        >
          {badgeElement}
        </AccountActionsPopover>
      );
    }

    return badgeElement;
  }

  // Compact variant - avatar (16px) wrapped in badge background
  if (variant === 'compact') {
    const badgeContent = (
      <>
        <Avatar
          address={address}
          size={16}
        />
        <span className="min-w-0 text-xs">
          {klerosLabel ? (
            <KlerosTagBadge
              label={klerosLabel}
              publicNote={klerosTag?.publicNote}
              labelClassName={clsx('block font-zen', labelClasses)}
            />
          ) : primaryLabel ? (
            <span
              className={clsx('block font-zen', labelClasses)}
              title={primaryLabelTitle}
            >
              {primaryLabel}
            </span>
          ) : (
            <Name
              address={address as `0x${string}`}
              className={clsx('block', labelClasses)}
            />
          )}
        </span>
        {adapterBadge}
        {linkTo === 'explorer' && <ExternalLinkIcon className="h-3 w-3" />}
        {showCopy && (
          <LuCopy
            className="h-3 w-3 cursor-pointer transition-colors hover:text-primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleCopy();
            }}
          />
        )}
      </>
    );

    const compactClasses = clsx(
      'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs',
      mounted && isOwner ? 'bg-green-500/10 text-green-500' : 'bg-hovered text-secondary',
      copyable && 'cursor-pointer transition-colors hover:brightness-110',
      href && 'no-underline transition-colors hover:bg-gray-300 hover:text-primary hover:no-underline dark:hover:bg-gray-700',
      className,
    );

    const compactElement = href ? (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Link
          href={href}
          target={linkTo === 'explorer' ? '_blank' : undefined}
          rel={linkTo === 'explorer' ? 'noopener noreferrer' : undefined}
          className={compactClasses}
          onClick={(e) => {
            if (copyable) {
              e.preventDefault();
              void handleCopy();
            } else if (linkTo === 'explorer') {
              e.stopPropagation();
            }
          }}
        >
          {badgeContent}
        </Link>
      </motion.div>
    ) : (
      <motion.div
        className={compactClasses}
        onClick={copyable ? () => void handleCopy() : undefined}
        style={{ cursor: copyable ? 'pointer' : 'default' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {badgeContent}
      </motion.div>
    );

    if (showActions) {
      return (
        <AccountActionsPopover
          address={address}
          chainId={chainId ?? vaultIdentity?.chainId}
          extraLinks={actionLinks}
          profileHref={actionsProfileHref}
          profileLabel={actionsProfileLabel}
        >
          {compactElement}
        </AccountActionsPopover>
      );
    }

    return compactElement;
  }

  const isBookmarked = showBookmark ? isAddressBookmarked(address) : false;
  const fullAvatar = metadataImageUrl ? (
    <Image
      src={metadataImageUrl}
      alt={vaultIdentity?.displayName ?? `Avatar for ${address}`}
      width={36}
      height={36}
      className="rounded-full bg-hovered object-cover"
      unoptimized
      onError={() => setMetadataImageFailed(true)}
    />
  ) : (
    <Avatar
      address={address}
      size={36}
    />
  );

  const addressBadge = (
    <span
      className={clsx(
        FULL_ACCOUNT_CHIP_CLASS,
        'cursor-pointer gap-1 bg-hovered font-monospace text-secondary transition-colors hover:brightness-110',
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleCopy();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          void handleCopy();
        }
      }}
    >
      {shortAddress}
      <LuCopy className="h-3.5 w-3.5" />
    </span>
  );

  const identityTrigger = (
    <div className="inline-flex items-center gap-2">
      {fullAvatar}
      {addressBadge}
    </div>
  );

  const metadataChips = (
    <>
      {mounted && isOwner && (
        <span className={clsx(FULL_ACCOUNT_CHIP_CLASS, 'gap-1 bg-green-500/10 font-zen text-green-500')}>
          <FaCircle size={6} />
          Connected
        </span>
      )}

      {mainTag && vaultIdentity?.kind === 'vault-adapter' ? (
        <Tooltip
          content={
            <TooltipContent
              title={`Adapter for ${vaultIdentity.displayName}`}
              detail="This account holds Morpho Blue positions on behalf of the vault. The adapter and vault are separate accounts."
            />
          }
        >
          <span className={getMainTagClassName(mainTag.kind)}>
            <span
              className={labelClasses}
              title={mainTag.title}
            >
              {mainTag.label}
            </span>
          </span>
        </Tooltip>
      ) : mainTag?.kind === 'kleros' ? (
        <span className={getMainTagClassName(mainTag.kind)}>
          <KlerosTagBadge
            label={mainTag.label}
            publicNote={klerosTag?.publicNote}
            labelClassName={labelClasses}
          />
        </span>
      ) : mainTag ? (
        <span className={getMainTagClassName(mainTag.kind)}>
          <span
            className={labelClasses}
            title={mainTag.title}
          >
            {mainTag.label}
          </span>
        </span>
      ) : null}

      {entityBadge && <span className={clsx(FULL_ACCOUNT_CHIP_CLASS, 'bg-hovered text-secondary')}>{entityBadge}</span>}

      {linkedVaultHref && (
        <Tooltip content={<TooltipContent title="Open vault account" />}>
          <Link
            href={linkedVaultHref}
            className={clsx(
              FULL_ACCOUNT_CHIP_CLASS,
              'gap-1 bg-hovered text-secondary no-underline transition-colors hover:text-primary hover:no-underline',
            )}
            aria-label={`Open vault account for ${vaultIdentity?.displayName ?? 'linked vault'}`}
          >
            <span>Vault</span>
            <LuLink className="h-3.5 w-3.5" />
          </Link>
        </Tooltip>
      )}

      {linkTo === 'explorer' && href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-secondary transition-colors hover:text-primary"
          aria-label="View on explorer"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      )}

      {showBookmark && (
        <button
          type="button"
          className={clsx(FULL_ACCOUNT_ICON_BUTTON_CLASS, isBookmarked ? 'text-primary' : 'text-secondary hover:text-primary')}
          aria-label={isBookmarked ? 'Remove address bookmark' : 'Bookmark address'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleAddressBookmark(address);
          }}
        >
          {isBookmarked ? <RiBookmarkFill className="h-4 w-4" /> : <RiBookmarkLine className="h-4 w-4" />}
        </button>
      )}
    </>
  );

  const fullClasses = clsx('flex flex-wrap items-center gap-2', className);

  const fullTrigger = showActions ? (
    <AccountActionsPopover
      address={address}
      chainId={chainId ?? vaultIdentity?.chainId}
      extraLinks={actionLinks}
      profileHref={actionsProfileHref}
      profileLabel={actionsProfileLabel}
    >
      {identityTrigger}
    </AccountActionsPopover>
  ) : href && linkTo === 'profile' ? (
    <div className="inline-flex items-center gap-2">
      <Link
        href={href}
        className="inline-flex items-center no-underline"
      >
        {fullAvatar}
      </Link>
      {addressBadge}
    </div>
  ) : (
    identityTrigger
  );

  return (
    <div className={fullClasses}>
      {fullTrigger}
      {metadataChips}
    </div>
  );
}
