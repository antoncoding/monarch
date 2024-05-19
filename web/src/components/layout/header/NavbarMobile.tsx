import { useCallback, useState } from 'react';
import { Cross1Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { clsx } from 'clsx';
import AccountConnect from './AccountConnect';
import { NavbarLink, NavbarTitle } from './Navbar';

export default function NavbarMobile() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleMobileMenuOpen = useCallback(() => setMobileMenuOpen((open) => !open), []);

  if (isMobileMenuOpen) {
    return (
      <nav className="sm:max-h-100 bg-primary flex flex-col gap-4 rounded-sm p-2 backdrop-blur-2xl">
        <div
          className={[
            'flex flex-1 flex-grow items-center justify-between',
            'bg-secondary rounded-sm p-4 backdrop-blur-2xl',
          ].join(' ')}
        >
          <div className="h-38 flex grow items-center justify-between gap-4">
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
              <NavbarLink href="/markets">Markets</NavbarLink>
            </li>

            <li className="flex">
              <NavigationMenu.Root className="relative flex flex-grow flex-col">
                <NavigationMenu.Viewport className={clsx('flex flex-col justify-center')} />
              </NavigationMenu.Root>
            </li>
          </ul>
          <div className="mx-2 mt-4">
            <AccountConnect />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={[
        'flex flex-1 flex-grow items-center justify-between',
        'rounded-sm border border-stone-200 bg-white bg-opacity-10 p-2 backdrop-blur-2xl',
        'mx-4',
      ].join(' ')}
    >
      <div className="flex h-8 grow items-center justify-between gap-4">
        <NavbarTitle />
        <button type="button" aria-label="Menu" data-state="closed" onClick={toggleMobileMenuOpen}>
          <HamburgerMenuIcon width="24" height="24" />
        </button>
      </div>
    </nav>
  );
}
