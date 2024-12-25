import { useCallback, useState } from 'react';
import { Cross1Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { clsx } from 'clsx';
import { useAccount } from 'wagmi';
import AccountConnect from './AccountConnect';
import { NavbarLink, NavbarTitle } from './Navbar';

export default function NavbarMobile() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleMobileMenuOpen = useCallback(() => setMobileMenuOpen((open) => !open), []);

  const { address } = useAccount();

  const navbarClass = [
    'flex flex-1 flex-grow items-center justify-between',
    'rounded bg-surface p-4 backdrop-blur-2xl',
    'mx-4',
  ].join(' ');

  if (isMobileMenuOpen) {
    return (
      <nav className="sm:max-h-100 bg-surface flex flex-col gap-4 rounded p-2 backdrop-blur-2xl">
        <div className={navbarClass}>
          <div className="flex grow items-center justify-between gap-4">
            <NavbarTitle />
            <button
              type="button"
              aria-label="Menu"
              data-state="open"
              onClick={toggleMobileMenuOpen}
            >
              <Cross1Icon width="24" height="24" />
            </button>
          </div>
        </div>
        <div>
          <ul className="mx-2 flex flex-col gap-4">
            <li className="flex">
              <NavbarLink href="/" matchKey="/">
                <p className="text-base opacity-80 hover:opacity-100">Home</p>
              </NavbarLink>
            </li>
            <li className="flex">
              <NavbarLink href="/markets" matchKey="/markets">
                <p className="text-base opacity-80 hover:opacity-100">Markets</p>
              </NavbarLink>
            </li>
            <li className="flex">
              <NavbarLink href={`/positions/${address ?? ''}`} matchKey="/positions">
                <p className="text-base opacity-80 hover:opacity-100">Portfolio</p>
              </NavbarLink>
            </li>
            <li className="flex">
              <NavigationMenu.Root className="relative flex flex-grow flex-col">
                <NavigationMenu.Viewport className={clsx('flex flex-col justify-center')} />
              </NavigationMenu.Root>
            </li>
          </ul>
          <div className="mx-2 mt-4">
            <AccountConnect onConnectPath="positions" />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className={navbarClass}>
      <div className="flex h-8 grow items-center justify-between gap-4">
        <NavbarTitle />
        <button type="button" aria-label="Menu" data-state="closed" onClick={toggleMobileMenuOpen}>
          <HamburgerMenuIcon width="24" height="24" />
        </button>
      </div>
    </nav>
  );
}
