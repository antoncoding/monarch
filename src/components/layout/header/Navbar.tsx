'use client';

import { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConnection } from 'wagmi';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';
import { HeaderMenuItems } from './HeaderMenuItems';
import { TransactionIndicator } from './TransactionIndicator';

export function NavbarLink({
  children,
  href,
  matchKey,
  target,
}: {
  children: React.ReactNode;
  href: string;
  matchKey?: string;
  target?: string;
}) {
  const pathname = usePathname();
  const isActive = matchKey ? pathname.includes(matchKey) : pathname === href;

  return (
    <Link
      href={href}
      className={clsx(
        'px-3 py-1 text-center font-zen text-sm font-normal text-primary no-underline transition-all duration-200',
        !isActive && 'hover:text-primary/80',
      )}
      target={target}
    >
      <span
        className={clsx(
          'relative after:absolute after:bottom-[-4px] after:left-0 after:h-[1.5px] after:w-full after:bg-primary after:transition-opacity',
          isActive ? 'after:opacity-100' : 'after:opacity-0',
        )}
      >
        {children}
      </span>
    </Link>
  );
}

export function NavbarTitle() {
  return (
    <div className="flex h-8 items-center justify-start gap-3">
      <Image
        src={logo}
        alt="logo"
        height={24}
      />
      <Link
        href="/"
        passHref
        className="text-center font-zen text-base font-normal text-primary no-underline"
        aria-label="Monarch home"
      >
        Monarch
      </Link>
    </div>
  );
}

export function Navbar() {
  const { address } = useConnection();
  const [mounted, setMounted] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const positionsHref = mounted && address ? `/positions/${address}` : '/positions';

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="flex h-full w-full items-center justify-between">
      <NavbarTitle />

      <div className="flex items-center gap-1">
        {/* Nav links with dashed dividers */}
        <div className="flex items-center">
          <NavbarLink
            href="/markets"
            matchKey="/market"
          >
            Markets
          </NavbarLink>
          <span className="mx-1 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />
          <NavbarLink
            href={positionsHref}
            matchKey="/position"
          >
            Positions
          </NavbarLink>
          <span className="mx-1 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />
          <NavbarLink
            href="/autovault"
            matchKey="/autovault"
          >
            Autovaults
          </NavbarLink>
          <span className="mx-1 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />

          <DropdownMenu onOpenChange={setIsMoreOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={clsx(
                  'px-3 py-1 text-center font-zen text-sm font-normal text-primary',
                  'border-none transition-all duration-200',
                  'inline-flex items-center gap-1',
                  'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
                  'active:outline-none active:ring-0',
                  'bg-transparent hover:bg-transparent active:bg-transparent hover:text-primary/80',
                  '[&:not(:focus-visible)]:outline-none',
                )}
              >
                More
                <ChevronDownIcon className={clsx('h-3 w-3 transition-transform duration-200 ease-in-out', isMoreOpen && 'rotate-180')} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[180px]"
            >
              <HeaderMenuItems includeAutovault={false} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <span className="mx-3 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />

        <TransactionIndicator />

        <div className="flex items-center">
          <AccountConnect />
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
