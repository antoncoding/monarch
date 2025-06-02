'use client';

import { useEffect, useState } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@nextui-org/react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon } from 'react-icons/fa';
import { FiSettings } from 'react-icons/fi';
import { LuSunMedium } from 'react-icons/lu';
import { RiBookLine, RiDiscordFill, RiGithubFill } from 'react-icons/ri';
import { useAccount } from 'wagmi';
import { EXTERNAL_LINKS } from '@/utils/external';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';

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
        'px-2 py-1 text-center font-zen text-base font-normal text-primary no-underline',
        'relative after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-full after:bg-primary',
        'no-underline transition-all duration-200',
        isActive ? 'after:opacity-100' : 'after:opacity-0',
      )}
      target={target}
    >
      {children}
    </Link>
  );
}

export function NavbarTitle() {
  return (
    <div className="flex h-8 items-center justify-start gap-4">
      <Image src={logo} alt="logo" height={30} />
      <Link
        href="/"
        passHref
        className="text-center font-zen text-lg font-medium text-primary no-underline"
        aria-label="build-onchain-apps Github repository"
      >
        Monarch
      </Link>
    </div>
  );
}

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className="bg-surface flex h-full w-full items-center justify-between rounded px-4">
      <NavbarTitle />

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <NavbarLink href="/markets">Markets</NavbarLink>
          {mounted ? (
            <>
              <NavbarLink href={address ? `/positions/${address}` : '/positions'}>
                Portfolio
              </NavbarLink>
              <NavbarLink href={address ? `/rewards/${address}` : '/rewards'} matchKey="/rewards">
                Rewards
              </NavbarLink>
            </>
          ) : (
            <>
              <NavbarLink href="/positions">Portfolio</NavbarLink>
              <NavbarLink href="/rewards" matchKey="/rewards">
                Rewards
              </NavbarLink>
            </>
          )}

          <Dropdown onOpenChange={setIsMoreOpen} className="rounded-sm">
            <DropdownTrigger>
              <button
                type="button"
                className={clsx(
                  'px-2 py-1 text-center font-zen text-base font-normal text-primary',
                  'border-none transition-all duration-200',
                  'inline-flex items-center gap-1',
                  'focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
                  'active:outline-none active:ring-0',
                  'bg-transparent hover:bg-transparent active:bg-transparent',
                  '[&:not(:focus-visible)]:outline-none',
                )}
              >
                More
                <ChevronDownIcon
                  className={clsx(
                    'h-4 w-4 transition-transform duration-200 ease-in-out',
                    isMoreOpen && 'rotate-180',
                  )}
                />
              </button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="More links"
              className="bg-surface min-w-[180px] rounded-sm border-none shadow-none"
              itemClasses={{
                base: [
                  'gap-4 px-4 py-2 rounded-none font-zen',
                  'data-[hover=true]:bg-hovered rounded-sm',
                ].join(' '),
                title: 'text-sm text-primary flex-grow font-zen',
                wrapper: 'justify-between no-underline rounded-sm',
              }}
            >
              <DropdownItem
                key="docs"
                endContent={<RiBookLine className="h-4 w-4" />}
                onClick={() => window.open(EXTERNAL_LINKS.docs, '_blank')}
              >
                Docs
              </DropdownItem>
              <DropdownItem
                key="discord"
                endContent={<RiDiscordFill className="h-4 w-4" />}
                onClick={() => window.open(EXTERNAL_LINKS.discord, '_blank')}
              >
                Discord
              </DropdownItem>
              <DropdownItem
                key="github"
                endContent={<RiGithubFill className="h-4 w-4" />}
                onClick={() => window.open(EXTERNAL_LINKS.github, '_blank')}
              >
                GitHub
              </DropdownItem>
              <DropdownItem
                key="theme"
                endContent={
                  mounted &&
                  (theme === 'dark' ? <LuSunMedium size={16} /> : <FaRegMoon size={14} />)
                }
                onClick={toggleTheme}
              >
                {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
              </DropdownItem>
              <DropdownItem key="settings" endContent={<FiSettings className="h-4 w-4" />}>
                <Link href="/settings" className="text-sm text-primary no-underline">
                  Settings
                </Link>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        <div className="flex items-center gap-6">
          <AccountConnect />
        </div>
      </div>
    </nav>
  );
}
export default Navbar;
