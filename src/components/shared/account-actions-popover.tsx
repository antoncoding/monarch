'use client';

import { useCallback, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LuCopy, LuExternalLink, LuFolderPlus, LuLink, LuUser, LuUserRoundCheck, LuWallet } from 'react-icons/lu';
import { RiBookmarkFill, RiBookmarkLine } from 'react-icons/ri';
import { SiEthereum } from 'react-icons/si';
import { useStyledToast } from '@/hooks/useStyledToast';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import type { Address } from 'viem';
import { MAX_PORTFOLIO_ACCOUNTS, useLocalPortfolios } from '@/stores/useLocalPortfolios';
import { useModal } from '@/hooks/useModal';
import { useRequirePositionAccount } from '@/hooks/useRequirePositionAccount';

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
  profileLabel = 'View Positions',
}: AccountActionsPopoverProps) {
  const toast = useStyledToast();
  const { toggleAddressBookmark, isAddressBookmarked } = usePortfolioBookmarks();
  const portfolios = useLocalPortfolios((state) => state.portfolios);
  const addAccount = useLocalPortfolios((state) => state.addAccount);
  const removeAccount = useLocalPortfolios((state) => state.removeAccount);
  const { open } = useModal();
  const { isExpectedAccount, requestExpectedAccount } = useRequirePositionAccount(address);
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

  const openableExtraLinks = extraLinks.map((link) => ({ ...link, href: link.href.trim() })).filter((link) => isOpenableHref(link.href));

  const togglePortfolioMembership = (portfolioId: string) => {
    const portfolio = portfolios.find((entry) => entry.id === portfolioId);
    if (!portfolio) return;
    const isIncluded = portfolio.accounts.some((account) => account.toLowerCase() === address.toLowerCase());

    if (isIncluded) {
      removeAccount(portfolio.id, address);
      toast.info('Account removed', `Removed from ${portfolio.name}.`);
      return;
    }

    addAccount(portfolio.id, address);
    toast.success('Added to portfolio', `Added to ${portfolio.name}.`);
  };

  const openCreatePortfolio = () => {
    open('createPortfolio', { initialAccounts: [address] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="inline-flex cursor-pointer items-center">{children}</div>
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
            startContent={isExternalHref(link.href) ? <LuExternalLink className="h-4 w-4" /> : <LuLink className="h-4 w-4" />}
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
        {!isExpectedAccount && (
          <DropdownMenuItem
            onClick={() => void requestExpectedAccount()}
            startContent={<LuUserRoundCheck className="h-4 w-4" />}
          >
            Switch to this account
          </DropdownMenuItem>
        )}
        {portfolios.length === 0 ? (
          <DropdownMenuItem
            onClick={openCreatePortfolio}
            startContent={<LuFolderPlus className="h-4 w-4" />}
          >
            Add to portfolio
          </DropdownMenuItem>
        ) : (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <LuFolderPlus className="h-4 w-4" />
              Add to portfolio
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {portfolios.map((portfolio) => {
                const checked = portfolio.accounts.some((account) => account.toLowerCase() === address.toLowerCase());
                return (
                  <DropdownMenuCheckboxItem
                    key={portfolio.id}
                    checked={checked}
                    disabled={!checked && portfolio.accounts.length >= MAX_PORTFOLIO_ACCOUNTS}
                    onCheckedChange={() => togglePortfolioMembership(portfolio.id)}
                  >
                    {portfolio.name}
                  </DropdownMenuCheckboxItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={openCreatePortfolio}
                startContent={<LuFolderPlus className="h-4 w-4" />}
              >
                Create new portfolio…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
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
