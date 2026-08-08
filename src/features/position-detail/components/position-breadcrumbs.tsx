'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { FiSearch } from 'react-icons/fi';
import { isAddress } from 'viem';
import { TokenIcon } from '@/components/shared/token-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';
import type { GroupedPosition } from '@/utils/types';
import { useLocalPortfolios } from '@/stores/useLocalPortfolios';
import { AccountActionsPopover } from '@/components/shared/account-actions-popover';

type PositionBreadcrumbsProps = {
  userAddress?: string;
  chainId?: SupportedNetworks;
  loanAssetAddress?: string;
  loanAssetSymbol?: string;
  allPositions?: GroupedPosition[];
  showPosition?: boolean;
  placeholderLabel?: string;
  rootLabel?: string;
  rootHref?: string;
  addressPath?: string;
};

export function PositionBreadcrumbs({
  userAddress,
  chainId,
  loanAssetAddress,
  loanAssetSymbol,
  allPositions = [],
  showPosition = true,
  placeholderLabel,
  rootLabel = 'Positions',
  rootHref = '/positions',
  addressPath = 'positions',
}: PositionBreadcrumbsProps) {
  const router = useRouter();
  const toast = useStyledToast();
  const portfolios = useLocalPortfolios((state) => state.portfolios);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inputAddress, setInputAddress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const networkImg = chainId ? getNetworkImg(chainId) : null;
  const networkName = chainId ? getNetworkName(chainId) : null;
  const hasMultiplePositions = showPosition && allPositions.length > 1;
  const hasAddress = !!userAddress;
  const addressValue = userAddress ?? '';
  const positionsByChain = useMemo(() => {
    const grouped = new Map<number, GroupedPosition[]>();
    allPositions.forEach((pos) => {
      const list = grouped.get(pos.chainId) ?? [];
      list.push(pos);
      grouped.set(pos.chainId, list);
    });
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([id, positions]) => ({
        chainId: id,
        positions: positions.sort((a, b) => (a.loanAssetSymbol ?? '').localeCompare(b.loanAssetSymbol ?? '')),
      }));
  }, [allPositions]);

  const handlePositionChange = (position: GroupedPosition) => {
    if (!userAddress) return;
    router.push(`/position/${position.chainId}/${position.loanAssetAddress}/${addressValue}`);
  };

  const handleAddressSearch = () => {
    if (!inputAddress.trim()) return;
    if (isAddress(inputAddress.toLowerCase(), { strict: false })) {
      router.push(`/${addressPath}/${inputAddress}`);
      setSearchOpen(false);
      setInputAddress('');
    } else {
      toast.error('Invalid address', `The address ${inputAddress} is not valid.`);
    }
  };

  const handleSearchClick = () => {
    if (searchOpen) {
      if (!inputAddress.trim()) {
        setSearchOpen(false);
        setInputAddress('');
        return;
      }
      handleAddressSearch();
    } else {
      setSearchOpen(true);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddressSearch();
    }
    if (e.key === 'Escape') {
      setSearchOpen(false);
      setInputAddress('');
    }
  };

  const handleSearchBlur = () => {
    if (!inputAddress.trim()) {
      setSearchOpen(false);
      setInputAddress('');
    }
  };

  useEffect(() => {
    if (searchOpen) {
      inputRef.current?.focus();
    }
  }, [searchOpen]);

  return (
    <nav className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden py-1 font-zen text-sm leading-none text-secondary">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 text-secondary hover:text-primary"
          >
            {rootLabel}
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => router.push('/positions')}>Positions</DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/portfolios')}>Portfolios</DropdownMenuItem>
          {portfolios.length > 0 && <DropdownMenuSeparator />}
          {portfolios.length > 0 && <DropdownMenuLabel className="text-xs text-secondary">Local portfolios</DropdownMenuLabel>}
          {portfolios.map((portfolio) => (
            <DropdownMenuItem
              key={portfolio.id}
              onClick={() => router.push(`/portfolios/${portfolio.slug}`)}
            >
              {portfolio.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {!hasAddress && placeholderLabel && (
        <>
          <span className="text-primary/60">/</span>
          <span className="text-secondary">{placeholderLabel}</span>
        </>
      )}

      {hasAddress && <span className="text-primary/60">/</span>}

      {hasAddress && (
        <div className="flex min-w-0 items-center gap-1.5 self-center">
          <div className="min-w-0">
            {searchOpen ? (
              <Input
                ref={inputRef}
                value={inputAddress}
                onValueChange={setInputAddress}
                onKeyDown={handleSearchKeyDown}
                onBlur={handleSearchBlur}
                placeholder="0x..."
                variant="filled"
                size="sm"
                className="w-48 align-middle sm:w-[260px]"
              />
            ) : (
              <AccountActionsPopover
                address={addressValue as `0x${string}`}
                chainId={chainId}
                profileHref={`/${addressPath}/${addressValue}`}
                profileLabel="View Positions"
              >
                <button
                  type="button"
                  title={addressValue}
                  className="block max-w-56 truncate border-secondary/60 border-b border-dotted text-secondary hover:border-secondary hover:border-solid hover:text-primary sm:max-w-none"
                >
                  {addressValue}
                </button>
              </AccountActionsPopover>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-secondary min-w-0 px-2"
            aria-label={searchOpen ? 'Search address' : 'Open address search'}
            onClick={handleSearchClick}
          >
            <FiSearch className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {showPosition && hasAddress && <ChevronRightIcon className="h-4 w-4 text-primary/60" />}

      {/* Current position: Chain + Asset (dropdown if multiple positions) */}
      {showPosition && hasAddress && hasMultiplePositions ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded px-2 py-1 text-primary hover:bg-hovered/60 border border-transparent hover:border-border/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
            >
              {networkImg && (
                <Image
                  src={networkImg}
                  alt={networkName ?? `Chain ${chainId}`}
                  width={14}
                  height={14}
                />
              )}
              {loanAssetAddress && chainId && (
                <TokenIcon
                  address={loanAssetAddress}
                  chainId={chainId}
                  symbol={loanAssetSymbol ?? ''}
                  width={14}
                  height={14}
                />
              )}
              <span>{loanAssetSymbol ?? 'Position'}</span>
              <ChevronDownIcon className="h-4 w-4 text-secondary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {positionsByChain.map((group, index) => (
              <div key={group.chainId}>
                <DropdownMenuLabel className="text-xs text-secondary">
                  {getNetworkImg(group.chainId) && (
                    <Image
                      src={getNetworkImg(group.chainId) ?? ''}
                      alt={getNetworkName(group.chainId) ?? `Chain ${group.chainId}`}
                      width={12}
                      height={12}
                      className="inline-block mr-2"
                    />
                  )}
                  {getNetworkName(group.chainId) ?? `Chain ${group.chainId}`} · {group.chainId}
                </DropdownMenuLabel>
                {group.positions.map((pos) => (
                  <DropdownMenuItem
                    key={`${pos.loanAssetAddress}-${pos.chainId}`}
                    onClick={() => handlePositionChange(pos)}
                    className={
                      pos.loanAssetAddress.toLowerCase() === loanAssetAddress?.toLowerCase() && pos.chainId === chainId ? 'bg-hovered' : ''
                    }
                  >
                    <div className="flex items-center gap-2">
                      <TokenIcon
                        address={pos.loanAssetAddress}
                        chainId={pos.chainId}
                        symbol={pos.loanAssetSymbol}
                        width={16}
                        height={16}
                      />
                      <span>{pos.loanAssetSymbol}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
                {index < positionsByChain.length - 1 && <DropdownMenuSeparator />}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : showPosition && hasAddress ? (
        <div className="flex items-center gap-1.5 text-primary">
          {networkImg && (
            <Image
              src={networkImg}
              alt={networkName ?? `Chain ${chainId}`}
              width={14}
              height={14}
            />
          )}
          {loanAssetAddress && chainId && (
            <TokenIcon
              address={loanAssetAddress}
              chainId={chainId}
              symbol={loanAssetSymbol ?? ''}
              width={14}
              height={14}
            />
          )}
          <span>{loanAssetSymbol ?? 'Position'}</span>
        </div>
      ) : null}
    </nav>
  );
}
