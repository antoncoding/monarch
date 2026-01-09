'use client';

import { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon } from 'react-icons/fa';
import { FiSettings } from 'react-icons/fi';
import { LuSunMedium } from 'react-icons/lu';
import { RiBookLine, RiDiscordFill, RiGithubFill } from 'react-icons/ri';
import { TbReport } from 'react-icons/tb';
import { useConnection } from 'wagmi';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EXTERNAL_LINKS } from '@/utils/external';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';
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
        className="text-center font-zen text-base font-medium text-primary no-underline"
        aria-label="Monarch home"
      >
        Monarch
      </Link>
    </div>
  );
}

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { address } = useConnection();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className="flex h-full w-full items-center justify-between">
      <NavbarTitle />

      <div className="flex items-center gap-1">
        {/* Nav links with dashed dividers */}
        <div className="flex items-center">
          <NavbarLink href="/markets">Markets</NavbarLink>
          <span className="mx-1 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />
          <NavbarLink
            href="/autovault"
            matchKey="/autovault"
          >
            Autovault
          </NavbarLink>
          <span className="mx-1 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />
          {mounted ? (
            <>
              <NavbarLink href={address ? `/positions/${address}` : '/positions'}>Portfolio</NavbarLink>
              <span className="mx-1 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />
              <NavbarLink
                href={address ? `/rewards/${address}` : '/rewards'}
                matchKey="/rewards"
              >
                Rewards
              </NavbarLink>
            </>
          ) : (
            <>
              <NavbarLink href="/positions">Portfolio</NavbarLink>
              <span className="mx-1 h-4 border-l border-dashed border-[var(--grid-cell-muted)]" />
              <NavbarLink
                href="/rewards"
                matchKey="/rewards"
              >
                Rewards
              </NavbarLink>
            </>
          )}
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
              <DropdownMenuItem
                endContent={<RiBookLine className="h-4 w-4" />}
                onClick={() => window.open(EXTERNAL_LINKS.docs, '_blank')}
              >
                Docs
              </DropdownMenuItem>
              <DropdownMenuItem
                endContent={<RiDiscordFill className="h-4 w-4" />}
                onClick={() => window.open(EXTERNAL_LINKS.discord, '_blank')}
              >
                Discord
              </DropdownMenuItem>
              <DropdownMenuItem
                endContent={<RiGithubFill className="h-4 w-4" />}
                onClick={() => window.open(EXTERNAL_LINKS.github, '_blank')}
              >
                GitHub
              </DropdownMenuItem>
              {mounted && address && (
                <DropdownMenuItem
                  endContent={<TbReport className="h-4 w-4" />}
                  onClick={() => router.push(`/positions/report/${address}`)}
                >
                  Report
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                endContent={mounted && (theme === 'dark' ? <LuSunMedium size={16} /> : <FaRegMoon size={14} />)}
                onClick={toggleTheme}
              >
                {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
              </DropdownMenuItem>
              <DropdownMenuItem
                endContent={<FiSettings className="h-4 w-4" />}
                onClick={() => router.push('/settings')}
              >
                Settings
              </DropdownMenuItem>
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
