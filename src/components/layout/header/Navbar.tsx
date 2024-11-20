'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon, FaSun } from 'react-icons/fa';
import { RiMenu3Line, RiCloseLine } from 'react-icons/ri';
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
  const isActive = pathname.includes(matchKey ?? href);

  return (
    <NextLink
      href={href}
      className={clsx(
        'px-2 py-1 text-center text-base font-normal text-primary no-underline',
        'relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 after:ease-out',
        isActive && 'after:origin-bottom-left after:scale-x-100',
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

function Navbar() {
  const { theme, setTheme } = useTheme();
  const { address } = useAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  return (
    <nav
      className={clsx(
        'flex flex-1 flex-grow items-center justify-between',
        'bg-surface rounded-[5px] p-4 shadow-sm backdrop-blur-2xl',
      )}
    >
      <NavbarTitle />
      <div className="flex items-center gap-8">
        {/* Desktop Navigation */}
        <ul className="hidden items-center justify-end gap-4 text-opacity-80 md:flex">
          <li className="flex">
            <NavbarLink href={`/positions/${address ?? ''}`} matchKey="positions">
              Dashboard
            </NavbarLink>
          </li>
          <li className="flex">
            <NavbarLink href="/markets" matchKey="markets">
              Markets
            </NavbarLink>
          </li>
          <li className="flex">
            <NavbarLink href={`/rewards/${address ?? ''}`} matchKey="rewards">
              Rewards
            </NavbarLink>
          </li>
        </ul>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden flex items-center text-primary"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle mobile menu"
        >
          {isMobileMenuOpen ? <RiCloseLine size={24} /> : <RiMenu3Line size={24} />}
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-primary hover:bg-surface-hover"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <FaSun size={20} /> : <FaRegMoon size={20} />}
          </button>
          <AccountConnect />
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-[72px] left-0 right-0 bg-surface p-4 shadow-lg md:hidden z-50">
          <ul className="flex flex-col gap-4">
            <li>
              <NavbarLink href={`/positions/${address ?? ''}`} matchKey="positions">
                Dashboard
              </NavbarLink>
            </li>
            <li>
              <NavbarLink href="/markets" matchKey="markets">
                Markets
              </NavbarLink>
            </li>
            <li>
              <NavbarLink href={`/rewards/${address ?? ''}`} matchKey="rewards">
                Rewards
              </NavbarLink>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
