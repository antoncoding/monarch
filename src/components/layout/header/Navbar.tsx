'use client';

import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { clsx } from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon, FaSun } from 'react-icons/fa';
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
        'px-2 py-1 text-center font-inter font-zen text-base font-normal text-primary no-underline',
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

  return (
    <nav
      className={clsx(
        'flex flex-1 flex-grow items-center justify-between',
        'rounded-[5px] bg-secondary p-4 shadow-sm backdrop-blur-2xl',
      )}
    >
      <div className="flex h-8 grow items-center justify-between gap-2">
        <NavbarTitle />
        <div className="flex items-center justify-start gap-8">
          <ul className="hidden items-center justify-start gap-4 text-opacity-80 md:flex">
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
            <li className="flex">
              <NavigationMenu.Root className="relative">
                <NavigationMenu.Viewport
                  className={clsx(
                    'absolute flex justify-center',
                    'left-[-20%] top-[100%] w-[140%]',
                  )}
                />
              </NavigationMenu.Root>
            </li>
          </ul>
          <AccountConnect />

          {theme === 'dark' ? (
            <FaSun
              onClick={() => {
                setTheme('light');
              }}
              className="h-4 w-4 transition duration-300 ease-in-out hover:scale-110"
            />
          ) : (
            <FaRegMoon
              onClick={() => {
                setTheme('dark');
              }}
              className="h-4 w-4 transition duration-300 ease-in-out hover:scale-110"
            />
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
