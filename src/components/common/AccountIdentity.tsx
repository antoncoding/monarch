'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FaCircle } from 'react-icons/fa';
import { LuExternalLink, LuCopy } from 'react-icons/lu';
import { useConnection, useEnsName } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { AccountActionsPopover } from '@/components/common/AccountActionsPopover';
import { Name } from '@/components/common/Name';
import { useAddressLabel } from '@/hooks/useAddressLabel';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import type { Address } from 'viem';

type AccountIdentityProps = {
  address: Address;
  variant?: 'badge' | 'compact' | 'full';
  linkTo?: 'explorer' | 'profile' | 'none';
  copyable?: boolean;
  showCopy?: boolean;
  showAddress?: boolean;
  showActions?: boolean;
  className?: string;
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
  variant = 'badge',
  linkTo = 'none',
  copyable = false,
  showCopy = false,
  showAddress = false,
  showActions = true,
  className,
}: AccountIdentityProps) {
  const { address: connectedAddress, isConnected } = useConnection();
  const [mounted, setMounted] = useState(false);
  const toast = useStyledToast();
  const { vaultName, shortAddress } = useAddressLabel(address);
  const { data: ensName } = useEnsName({
    address: address as `0x${string}`,
    chainId: 1,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOwner = useMemo(() => {
    return mounted && isConnected && address === connectedAddress;
  }, [address, connectedAddress, isConnected, mounted]);

  const href = useMemo(() => {
    // When showActions is enabled, don't use linkTo - popover handles navigation
    if (showActions) return null;

    if (linkTo === 'none') return null;
    if (linkTo === 'explorer') {
      return getExplorerURL(address as `0x${string}`, SupportedNetworks.Mainnet);
    }
    if (linkTo === 'profile') {
      return `/positions/${address}`;
    }
    return null;
  }, [linkTo, address, showActions]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, toast]);

  // Badge variant - minimal inline badge (no avatar)
  if (variant === 'badge') {
    const content = (
      <>
        {vaultName ? <span className="font-zen">{vaultName}</span> : <Name address={address as `0x${string}`} />}
        {linkTo === 'explorer' && <LuExternalLink className="h-3 w-3" />}
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
      return <AccountActionsPopover address={address}>{badgeElement}</AccountActionsPopover>;
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
        <span className="text-xs">
          {vaultName ? <span className="font-zen">{vaultName}</span> : <Name address={address as `0x${string}`} />}
        </span>
        {linkTo === 'explorer' && <LuExternalLink className="h-3 w-3" />}
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
      return <AccountActionsPopover address={address}>{compactElement}</AccountActionsPopover>;
    }

    return compactElement;
  }

  // Full variant - avatar + address badge + extra info badges (all on one line, centered)
  const fullContent = (
    <>
      <Avatar
        address={address}
        size={36}
      />

      {/* Address badge - always shows shortened address, click to copy */}
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
            void handleCopy();
          }
        }}
      >
        {shortAddress}
        <LuCopy className="h-3.5 w-3.5" />
      </span>

      {/* Connected indicator badge */}
      {mounted && isOwner && (
        <span className="inline-flex items-center gap-1 rounded-sm bg-green-500/10 px-2 py-1 font-zen text-xs text-green-500">
          <FaCircle size={6} />
          Connected
        </span>
      )}

      {/* ENS badge (only show if there's an actual ENS name) */}
      {showAddress && !vaultName && ensName && (
        <span className="inline-flex items-center rounded-sm bg-hovered px-2 py-1 font-zen text-xs text-secondary">{ensName}</span>
      )}

      {/* Vault name badge (if it's a vault) */}
      {vaultName && (
        <span className="inline-flex items-center rounded-sm bg-hovered px-2 py-1 font-zen text-xs text-secondary">{vaultName}</span>
      )}

      {/* Explorer link */}
      {linkTo === 'explorer' && href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-secondary transition-colors hover:text-primary"
          aria-label="View on explorer"
          onClick={(e) => e.stopPropagation()}
        >
          <LuExternalLink className="h-4 w-4" />
        </a>
      )}
    </>
  );

  const fullClasses = clsx('flex items-center gap-2', copyable && 'cursor-pointer transition-colors hover:brightness-110', className);

  const fullElement =
    href && linkTo === 'profile' ? (
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Link
          href={href}
          className={fullClasses}
        >
          {fullContent}
        </Link>
      </motion.div>
    ) : (
      <motion.div
        className={fullClasses}
        onClick={copyable ? () => void handleCopy() : undefined}
        style={{ cursor: copyable ? 'pointer' : 'default' }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {fullContent}
      </motion.div>
    );

  if (showActions) {
    return <AccountActionsPopover address={address}>{fullElement}</AccountActionsPopover>;
  }

  return fullElement;
}
