'use client';

import { useCallback, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { LuCopy, LuExternalLink, LuLink, LuUser, LuWallet } from 'react-icons/lu';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import { SiEthereum } from 'react-icons/si';
import { useStyledToast } from '@/hooks/useStyledToast';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import type { Address } from 'viem';

type AccountActionsPopoverProps = {
  address: Address;
  children?: ReactNode;
  chainId?: number;
  extraLinks?: AccountActionLink[];
  profileHref?: string;
  profileLabel?: string;
};

type AccountActionLink = {
  href: string;
  label: string;
};

const isExternalHref = (href: string) => /^https?:\/\//i.test(href);
const isAppRelativeHref = (href: string) => href.startsWith('/') && !href.startsWith('//');
const isOpenableHref = (href: string) => isExternalHref(href) || isAppRelativeHref(href);

/**
 * Dropdown menu showing account actions:
 * - Copy address
 * - View account
 * - View contextual account links
 * - View on explorer
 */
export function AccountActionsPopover({
  address,
  chainId,
  children,
  extraLinks = [],
  profileHref = `/positions/${address}`,
  profileLabel = 'View Portfolio',
}: AccountActionsPopoverProps) {
  const toast = useStyledToast();
  const { toggleAddressBookmark, isAddressBookmarked } = usePortfolioBookmarks();
  const isBookmarked = isAddressBookmarked(address);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, toast]);

  const handleOpenLink = useCallback((href: string) => {
    if (isExternalHref(href)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    if (isAppRelativeHref(href)) {
      window.location.assign(href);
    }
  }, []);

  const handleViewAccount = useCallback(() => {
    const href = profileHref.trim();

    if (isOpenableHref(href)) {
      handleOpenLink(href);
    }
  }, [handleOpenLink, profileHref]);

  const handleViewExplorer = useCallback(() => {
    const explorerUrl = getExplorerURL(address, (chainId ?? SupportedNetworks.Mainnet) as SupportedNetworks);
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  }, [address, chainId]);

  const handleViewDeBank = useCallback(() => {
    window.open(`https://debank.com/profile/${address}`, '_blank', 'noopener,noreferrer');
  }, [address]);

  const openableExtraLinks = extraLinks
    .map((link) => ({ ...link, href: link.href.trim() }))
    .filter((link) => isOpenableHref(link.href));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="cursor-pointer">{children}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={handleViewAccount}
          startContent={<LuUser className="h-4 w-4" />}
        >
          {profileLabel}
        </DropdownMenuItem>
        {openableExtraLinks.map((link) => (
          <DropdownMenuItem
            key={`${link.label}-${link.href}`}
            onClick={() => handleOpenLink(link.href)}
            startContent={
              isExternalHref(link.href) ? <LuExternalLink className="h-4 w-4" /> : <LuLink className="h-4 w-4" />
            }
          >
            {link.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          onClick={() => toggleAddressBookmark(address)}
          startContent={isBookmarked ? <RiBookmarkFill className="h-4 w-4" /> : <RiBookmarkLine className="h-4 w-4" />}
        >
          {isBookmarked ? 'Remove Bookmark' : 'Bookmark Address'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleViewExplorer}
          startContent={<SiEthereum className="h-4 w-4" />}
        >
          View on Explorer
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleViewDeBank}
          startContent={<LuWallet className="h-4 w-4" />}
        >
          View on DeBank
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void handleCopy()}
          startContent={<LuCopy className="h-4 w-4" />}
        >
          Copy Address
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
