'use client';

import { useState } from 'react';
import { RiArrowRightLine, RiSearchLine } from 'react-icons/ri';
import Link from 'next/link';
import { isAddress } from 'viem';
import { useConnection } from 'wagmi';
import AccountConnect from '@/components/layout/header/AccountConnect';
import Header from '@/components/layout/header/Header';
import { Avatar } from '@/components/Avatar/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStyledToast } from '@/hooks/useStyledToast';
import { cn } from '@/utils';

type SearchOrConnectProps = {
  path: string;
  title: string;
};

export default function SearchOrConnect({ path, title }: SearchOrConnectProps) {
  const { address } = useConnection();
  const toast = useStyledToast();
  const [inputAddress, setInputAddress] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);

  const handleAddressSearch = () => {
    if (!inputAddress.trim()) {
      return;
    }
    if (isAddress(inputAddress.toLowerCase(), { strict: false })) {
      window.location.href = `/${path}/${inputAddress}`;
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

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />

      <div className="container h-full gap-8">
        {/* Title */}
        <div className="pb-4">
          <h1 className="font-zen">{title}</h1>
        </div>

        {/* Secondary text */}
        <p className="pb-8 text-lg text-secondary">
          {address ? 'View your portfolio or search another address' : `Connect to view your ${title.toLowerCase()} or search an address`}
        </p>

        {/* Action row */}
        <div className="flex items-center gap-2">
          {/* Collapsible search input */}
          <div className={cn('overflow-hidden transition-all duration-300 ease-out', searchOpen ? 'w-64' : 'w-0')}>
            <Input
              value={inputAddress}
              onValueChange={setInputAddress}
              onKeyDown={handleKeyDown}
              placeholder="0x..."
              variant="filled"
              size="md"
              autoFocus={searchOpen}
              classNames={{
                input: 'font-zen text-sm',
              }}
            />
          </div>

          {/* Search button - toggles input or submits */}
          <Button
            variant="default"
            size="md"
            onClick={handleSearchClick}
          >
            {searchOpen ? (
              <RiArrowRightLine className="h-4 w-4" />
            ) : (
              <>
                <RiSearchLine className="h-4 w-4" />
                Search
              </>
            )}
          </Button>

          {/* Connect or View button */}
          {address ? (
            <Link
              href={`/${path}/${address}`}
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
              <AccountConnect onConnectPath={path} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
