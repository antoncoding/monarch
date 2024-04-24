import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { clsx } from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';


export function NavbarLink({
  href,
  children,
  target,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  target?: string;
  ariaLabel?: string;
}) {
  return (
    <NextLink
      href={href}
      className="font-inter px-0 text-center text-base font-normal text-white no-underline"
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
        className="font-roboto text-center text-xl font-medium text-white no-underline"
        aria-label="build-onchain-apps Github repository"
      >
        Monarch
      </NextLink>
    </div>
  );
}

function Navbar() {
  return (
    <nav
      className={clsx(
        'flex flex-1 flex-grow items-center justify-between',
        'rounded-[5px] bg-monarch-soft-black p-4 backdrop-blur-2xl',
      )}
    >
      <div className="flex h-8 grow items-center justify-between gap-4">
        <NavbarTitle />
        <div className="flex items-center justify-start gap-8">
          <ul className="hidden items-center justify-start gap-8 md:flex">
            <li className="flex">
              <NavbarLink href="/browse">Browse</NavbarLink>
            </li>
            <li className="flex">
              <NavbarLink href="/browse">Supply</NavbarLink>
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
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
