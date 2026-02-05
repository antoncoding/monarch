'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RiArrowRightLine, RiBookmarkFill } from 'react-icons/ri';
import { FiSearch } from 'react-icons/fi';
import { isAddress } from 'viem';
import { useConnection, useEnsName } from 'wagmi';
import type { Address } from 'viem';
import Header from '@/components/layout/header/Header';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { Avatar } from '@/components/Avatar/Avatar';
import { TokenIcon } from '@/components/shared/token-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PositionBreadcrumbs } from '@/features/position-detail/components/position-breadcrumbs';
import { useStyledToast } from '@/hooks/useStyledToast';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { useAddressLabel } from '@/hooks/useAddressLabel';
import { cn } from '@/utils';
import { getNetworkName } from '@/utils/networks';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';

function AddressBadges({ address }: { address: string }) {
  const { vaultName } = useAddressLabel(address as Address);
  const { data: ensName } = useEnsName({
    address: address as `0x${string}`,
    chainId: 1,
  });

  if (vaultName) {
    return <span className="rounded bg-hovered px-2 py-0.5 text-[10px] text-secondary">{vaultName}</span>;
  }

  if (ensName) {
    return <span className="rounded bg-hovered px-2 py-0.5 text-[10px] text-secondary">{ensName}</span>;
  }

  return null;
}

export default function PositionsLandingView() {
  const router = useRouter();
  const { address } = useConnection();
  const toast = useStyledToast();
  const [inputAddress, setInputAddress] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { findToken } = useTokensQuery();

  const { addressBookmarks, positionBookmarks, visitedAddresses, visitedPositions } = usePortfolioBookmarks();

  const visitedMap = useMemo(() => {
    return visitedAddresses.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.address.toLowerCase()] = entry.lastVisited;
      return acc;
    }, {});
  }, [visitedAddresses]);

  const buildPositionKey = (ownerAddress: string, chainId: number, loanAssetAddress: string) =>
    `${ownerAddress.toLowerCase()}-${chainId}-${loanAssetAddress.toLowerCase()}`;

  const visitedPositionMap = useMemo(() => {
    return visitedPositions.reduce<Record<string, number>>((acc, entry) => {
      acc[buildPositionKey(entry.address, entry.chainId, entry.loanAssetAddress)] = entry.lastVisited;
      return acc;
    }, {});
  }, [visitedPositions]);

  const MAX_ITEMS = 10;

  const combinedList = useMemo(() => {
    const items: {
      key: string;
      type: 'address' | 'position';
      address: string;
      chainId?: number;
      loanAssetAddress?: string;
      loanAssetSymbol?: string;
      isBookmarked: boolean;
      bookmarkKind?: 'address' | 'position';
      lastSeen: number;
    }[] = [];

    addressBookmarks.forEach((entry) => {
      const lastSeen = visitedMap[entry.address] ?? entry.addedAt;
      items.push({
        key: `address-${entry.address}`,
        type: 'address',
        address: entry.address,
        isBookmarked: true,
        bookmarkKind: 'address',
        lastSeen,
      });
    });

    positionBookmarks.forEach((entry) => {
      const lastSeen = visitedPositionMap[buildPositionKey(entry.address, entry.chainId, entry.loanAssetAddress)] ?? entry.addedAt;
      items.push({
        key: `position-${entry.address}-${entry.chainId}-${entry.loanAssetAddress}`,
        type: 'position',
        address: entry.address,
        chainId: entry.chainId,
        loanAssetAddress: entry.loanAssetAddress,
        loanAssetSymbol: entry.loanAssetSymbol,
        isBookmarked: true,
        bookmarkKind: 'position',
        lastSeen,
      });
    });

    visitedAddresses.forEach((entry) => {
      const alreadyBookmarked = addressBookmarks.some((bookmark) => bookmark.address === entry.address);
      if (alreadyBookmarked) return;
      items.push({
        key: `recent-${entry.address}`,
        type: 'address',
        address: entry.address,
        isBookmarked: false,
        lastSeen: entry.lastVisited,
      });
    });

    visitedPositions.forEach((entry) => {
      const key = buildPositionKey(entry.address, entry.chainId, entry.loanAssetAddress);
      const alreadyBookmarked = positionBookmarks.some(
        (bookmark) => buildPositionKey(bookmark.address, bookmark.chainId, bookmark.loanAssetAddress) === key,
      );
      if (alreadyBookmarked) return;
      items.push({
        key: `recent-position-${entry.address}-${entry.chainId}-${entry.loanAssetAddress}`,
        type: 'position',
        address: entry.address,
        chainId: entry.chainId,
        loanAssetAddress: entry.loanAssetAddress,
        loanAssetSymbol: entry.loanAssetSymbol,
        isBookmarked: false,
        lastSeen: entry.lastVisited,
      });
    });

    return items
      .sort((a, b) => {
        if (a.isBookmarked !== b.isBookmarked) return a.isBookmarked ? -1 : 1;
        return b.lastSeen - a.lastSeen;
      })
      .slice(0, MAX_ITEMS);
  }, [addressBookmarks, positionBookmarks, visitedAddresses, visitedPositions, visitedMap, visitedPositionMap]);

  const handleAddressSearch = () => {
    if (!inputAddress.trim()) {
      return;
    }
    if (isAddress(inputAddress.toLowerCase(), { strict: false })) {
      router.push(`/positions/${inputAddress}`);
    } else {
      toast.error('Invalid address', `The address ${inputAddress} is not valid.`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddressSearch();
    }
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setInputAddress('');
    }
  };

  const handleSearchClick = () => {
    if (searchOpen) {
      handleAddressSearch();
    } else {
      setSearchOpen(true);
    }
  };

  const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatLastSeen = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes <= 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 pb-12">
        <div className="mt-6">
          <PositionBreadcrumbs
            showPosition={false}
            placeholderLabel="Search address"
            rootLabel="Position"
          />
        </div>

        <div className="mt-4 rounded border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-secondary">Quick start</span>
              <p className="text-sm text-secondary">
                {address ? 'Search any address or jump back to your portfolio.' : 'Search any address or connect your wallet.'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className={cn('overflow-hidden transition-all duration-300 ease-out', searchOpen ? 'w-64' : 'w-0')}>
              <Input
                value={inputAddress}
                onValueChange={setInputAddress}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!inputAddress.trim()) {
                    setSearchOpen(false);
                    setInputAddress('');
                  }
                }}
                placeholder="0x..."
                variant="filled"
                size="md"
                autoFocus={searchOpen}
                classNames={{
                  input: 'font-zen text-sm',
                }}
              />
            </div>

            <Button
              variant="default"
              size="md"
              onClick={handleSearchClick}
            >
              {searchOpen ? (
                <RiArrowRightLine className="h-4 w-4" />
              ) : (
                <>
                  <FiSearch className="h-4 w-4" />
                  Search
                </>
              )}
            </Button>

            {address ? (
              <Link
                href={`/positions/${address}`}
                className="no-underline"
              >
                <Button
                  variant="primary"
                  size="md"
                >
                  <Avatar
                    address={address}
                    size={20}
                  />
                  <span className="ml-2">View {address.slice(0, 6)}</span>
                </Button>
              </Link>
            ) : (
              <div className="[&>div]:flex-grow-0">
                <AccountConnect onConnectPath="positions" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 max-w-[720px] rounded border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-secondary">Pinned & Recent</h2>
          </div>
          {combinedList.length === 0 ? (
            <p className="text-sm text-secondary">No recent activity yet.</p>
          ) : (
            <div className="space-y-2">
              {combinedList.map((entry) => {
                const tokenInfo =
                  entry.type === 'position' && entry.chainId && entry.loanAssetAddress
                    ? findToken(entry.loanAssetAddress, entry.chainId)
                    : undefined;
                const symbol = entry.loanAssetSymbol ?? tokenInfo?.symbol ?? 'Token';
                const chainName = entry.chainId ? (getNetworkName(entry.chainId) ?? `Chain ${entry.chainId}`) : '';
                const link =
                  entry.type === 'position' && entry.chainId && entry.loanAssetAddress
                    ? `/position/${entry.chainId}/${entry.loanAssetAddress}/${entry.address}`
                    : `/positions/${entry.address}`;

                return (
                  <div
                    key={entry.key}
                    className="flex flex-col gap-2 rounded border border-border/60 bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        address={entry.address as `0x${string}`}
                        size={20}
                      />
                      <Link
                        href={link}
                        className="no-underline hover:no-underline text-secondary hover:text-primary"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded bg-hovered px-2 py-1 text-xs font-monospace text-secondary">
                            {shorten(entry.address)}
                          </span>
                          <AddressBadges address={entry.address} />
                          {entry.type === 'position' && (
                            <>
                              <span className="text-secondary">{'>'}</span>
                              <span className="flex items-center gap-1 text-sm text-primary">
                                <TokenIcon
                                  address={entry.loanAssetAddress ?? ''}
                                  chainId={entry.chainId ?? 1}
                                  symbol={symbol}
                                  width={14}
                                  height={14}
                                />
                                {symbol}
                              </span>
                              {chainName && <span className="text-xs text-secondary">({chainName})</span>}
                            </>
                          )}
                        </span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-secondary">
                      {entry.bookmarkKind === entry.type && <RiBookmarkFill className="h-3.5 w-3.5 text-primary" />}
                      <span>Last seen {formatLastSeen(entry.lastSeen)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
