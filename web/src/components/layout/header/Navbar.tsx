import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { clsx } from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import { FaRegMoon, FaSun } from 'react-icons/fa';
import { useTheme } from '@/hooks/useTheme';
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
      className="font-inter text-primary px-0 text-center text-base font-normal no-underline"
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
        className="font-roboto text-primary text-center text-lg font-medium no-underline"
        aria-label="build-onchain-apps Github repository"
      >
        Monarch
      </NextLink>
    </div>
  );
}

function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      className={clsx(
        'flex flex-1 flex-grow items-center justify-between',
        'bg-secondary rounded-[5px] p-4 backdrop-blur-2xl',
      )}
    >
      <div className="flex h-8 grow items-center justify-between gap-4">
        <NavbarTitle />
        <div className="flex items-center justify-start gap-8">
          <ul className="hidden items-center justify-start gap-8 md:flex">
            <li className="flex">
              <NavbarLink href="/positions">
                {' '}
                <p className="text-base opacity-80 hover:opacity-100"> Portfolio </p>{' '}
              </NavbarLink>
            </li>
            <li className="flex">
              <NavbarLink href="/markets">
                {' '}
                <p className="text-base opacity-80 hover:opacity-100"> Markets </p>{' '}
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
                document.documentElement.classList.remove('dark');
                toggleTheme();
              }}
              className="h-4 w-4 transition duration-300 ease-in-out hover:scale-110"
            />
          ) : (
            <FaRegMoon
              onClick={() => {
                document.documentElement.classList.add('dark');
                toggleTheme();
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
