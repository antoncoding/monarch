'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon } from 'react-icons/fa';
import { FiSettings } from 'react-icons/fi';
import { LuSunMedium } from 'react-icons/lu';

import { useAccount } from 'wagmi';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';

export function NavbarLink({
  href,
  children,
  target,
  ariaLabel,
  matchKey,
}: {
  href: string;
  children: React.ReactNode;
  target?: string;
  ariaLabel?: string;
  matchKey?: string;
}) {
  const pathname = usePathname();
  const isActive = matchKey === '/' ? pathname === matchKey : pathname.includes(matchKey ?? href);

  return (
    <NextLink
      href={href}
      className={clsx(
        'px-2 py-1 text-center font-zen text-base font-normal text-primary no-underline',
        'relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:bg-primary',
        'transition-all duration-200 hover:-translate-y-[2px]',
        isActive ? 'after:opacity-100' : 'after:opacity-0',
      )}
      target={target}
      aria-label={ariaLabel}
    >
      {children}
    </NextLink>
  );
}

export function NavbarTitle() {
  return (
    <div className="flex h-8 items-center justify-start gap-4">
      <Image src={logo} alt="logo" height={30} />
      <NextLink
        href="/"
        passHref
        className="text-center font-zen text-lg font-medium text-primary no-underline"
        aria-label="build-onchain-apps Github repository"
      >
        Monarch
      </NextLink>
    </div>
  );
}

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className="bg-surface flex h-full w-full items-center justify-between rounded px-4 font-zen">
      <NavbarTitle />

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <NavbarLink href="/markets">Markets</NavbarLink>
          <NavbarLink href={`/positions/${address ?? ''}`}>Portfolio</NavbarLink>
          <NavbarLink href={`/rewards/${address ?? ''}`} matchKey="/rewards">
            Rewards
          </NavbarLink>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 items-center justify-center rounded-full"
            aria-label="Toggle theme"
          >
            {mounted && (theme === 'dark' ? <LuSunMedium size={20} /> : <FaRegMoon size={18} />)}
          </button>
          <Link
            href="/settings"
            className="inline-flex items-center justify-between self-stretch no-underline"
          >
            <FiSettings className="relative" size={18} />
          </Link>
          <AccountConnect onConnectPath="positions" />
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
