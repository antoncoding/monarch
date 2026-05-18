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
import { Name } from '@/components/shared/name';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Tooltip } from '@/components/ui/tooltip';
import { useAddressLabel } from '@/hooks/useAddressLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import type { VaultAccountIdentity } from '@/contexts/VaultRegistryContext';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import { formatVaultAdapterType } from '@/utils/vaults';
import type { Address } from 'viem';

const ACCOUNT_IDENTITY_LABEL_MAX_WIDTH_CLASS = 'max-w-[22rem]';

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
  className?: string;
};

type MainTagKind = 'adapter' | 'ens' | 'vault';

const getMainTagClassName = (kind: MainTagKind) =>
  clsx(
    'inline-flex min-w-0 items-center rounded-sm px-2 py-1 font-zen text-xs text-secondary',
    kind === 'adapter' ? 'border border-border bg-surface' : 'bg-hovered',
  );

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
 * Badge & Compact: Show vault name → ENS name → shortened address
 * Full: Always show address badge + optional extra badges (connected, ENS, vault)
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
      return `/positions/${address}`;
    }
    return null;
  }, [linkTo, address, showActions, chainId, vaultIdentity?.chainId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, toast]);

  const labelClasses = clsx('min-w-0 truncate', ACCOUNT_IDENTITY_LABEL_MAX_WIDTH_CLASS);
  const adapterTypeLabel = vaultIdentity?.kind === 'vault-adapter' ? formatVaultAdapterType(vaultIdentity.adapterType) : undefined;
  const mainTag = vaultIdentity
    ? {
        kind: vaultIdentity.kind === 'vault-adapter' ? ('adapter' as const) : ('vault' as const),
        label: adapterTypeLabel ?? vaultIdentity.displayName,
        title: adapterTypeLabel ?? vaultIdentity.displayName,
      }
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
      ? `/vault/${vaultIdentity.chainId}/${vaultIdentity.vaultAddress}`
      : undefined;

  // Badge variant - minimal inline badge (no avatar)
  if (variant === 'badge') {
    const content = (
      <>
        {vaultName ? (
          <span
            className={clsx('font-zen', labelClasses)}
            title={vaultName}
          >
            {vaultName}
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
          {vaultName ? (
            <span
              className={clsx('block font-zen', labelClasses)}
              title={vaultName}
            >
              {vaultName}
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
      className="inline-flex cursor-pointer items-center gap-1 rounded-sm bg-hovered px-2 py-1 font-monospace text-xs text-secondary transition-colors hover:brightness-110"
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
        <span className="inline-flex items-center gap-1 rounded-sm bg-green-500/10 px-2 py-1 font-zen text-xs text-green-500">
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

      {entityBadge && (
        <span className="inline-flex items-center rounded-sm bg-hovered px-2 py-1 text-xs text-secondary">{entityBadge}</span>
      )}

      {linkedVaultHref && (
        <Tooltip content={<TooltipContent title="Open vault account" />}>
          <Link
            href={linkedVaultHref}
            className="inline-flex items-center gap-1 rounded-sm bg-hovered px-2 py-1 text-xs text-secondary no-underline transition-colors hover:text-primary hover:no-underline"
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
          className={clsx('rounded-sm p-1 transition-colors', isBookmarked ? 'text-primary' : 'text-secondary hover:text-primary')}
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

  const fullClasses = clsx('flex items-center gap-2', className);

  const fullTrigger = showActions ? (
    <AccountActionsPopover
      address={address}
      chainId={chainId ?? vaultIdentity?.chainId}
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
