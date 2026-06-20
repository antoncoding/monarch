'use client';

import { useState } from 'react';
import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';
import { HeaderMenuItems } from './HeaderMenuItems';

export default function NavbarMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="flex h-full w-full items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center"
        >
          <Image
            src={logo}
            alt="logo"
            height={20}
          />
        </Link>

        <span className="h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />

        <DropdownMenu
          open={isMenuOpen}
          onOpenChange={setIsMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu"
              className={clsx(
                'p-1 text-primary',
                'border-none transition-all duration-200',
                'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
                'active:outline-none active:ring-0',
                'bg-transparent hover:bg-transparent active:bg-transparent',
              )}
            >
              <HamburgerMenuIcon
                width="18"
                height="18"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[200px]"
          >
            <HeaderMenuItems
              iconSide="start"
              itemClassName="py-3"
              onSelect={() => setIsMenuOpen(false)}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AccountConnect />
    </nav>
  );
}
