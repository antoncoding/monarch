'use client';

import { useEffect, useState } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from '@heroui/react';
import { HamburgerMenuIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon } from 'react-icons/fa';
import { FiSettings } from 'react-icons/fi';
import { LuSunMedium } from 'react-icons/lu';
import { RiBookLine, RiDiscordFill, RiGithubFill, RiLineChartLine, RiBriefcaseLine, RiGiftLine } from 'react-icons/ri';
import { useAccount } from 'wagmi';
import { EXTERNAL_LINKS } from '@/utils/external';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';

export default function NavbarMobile() {
  const { theme, setTheme } = useTheme();
  const { address } = useAccount();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    setIsMenuOpen(false);
  };

  const handleExternalLink = (url: string) => {
    window.open(url, '_blank');
    setIsMenuOpen(false);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-surface flex h-full w-full items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center"
        >
          <Image
            src={logo}
            alt="logo"
            height={24}
          />
        </Link>

        <Dropdown
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          placement="bottom-start"
          className="z-50 rounded-sm"
        >
          <DropdownTrigger>
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
                width="20"
                height="20"
              />
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Navigation menu"
            className="bg-surface min-w-[200px] rounded-sm border-none shadow-md"
            itemClasses={{
              base: ['gap-4 px-4 py-2 rounded-none font-zen', 'data-[hover=true]:bg-hovered rounded-sm'].join(' '),
              title: 'text-sm text-primary flex-grow font-zen',
              wrapper: 'justify-between no-underline rounded-sm',
            }}
          >
            <DropdownSection showDivider>
              <DropdownItem
                key="markets"
                startContent={<RiLineChartLine className="h-5 w-5" />}
                onClick={() => handleNavigation('/markets')}
                className="py-3"
              >
                <span className="font-medium">Markets</span>
              </DropdownItem>
              <DropdownItem
                key="portfolio"
                startContent={<RiBriefcaseLine className="h-5 w-5" />}
                onClick={() => handleNavigation(address ? `/positions/${address}` : '/positions')}
                className="py-3"
              >
                <span className="font-medium">Portfolio</span>
              </DropdownItem>
              <DropdownItem
                key="rewards"
                startContent={<RiGiftLine className="h-5 w-5" />}
                onClick={() => handleNavigation(address ? `/rewards/${address}` : '/rewards')}
                className="py-3"
              >
                <span className="font-medium">Rewards</span>
              </DropdownItem>
            </DropdownSection>
            <DropdownSection>
              <DropdownItem
                key="docs"
                startContent={<RiBookLine className="h-4 w-4" />}
                onClick={() => handleExternalLink(EXTERNAL_LINKS.docs)}
              >
                Docs
              </DropdownItem>
              <DropdownItem
                key="discord"
                startContent={<RiDiscordFill className="h-4 w-4" />}
                onClick={() => handleExternalLink(EXTERNAL_LINKS.discord)}
              >
                Discord
              </DropdownItem>
              <DropdownItem
                key="github"
                startContent={<RiGithubFill className="h-4 w-4" />}
                onClick={() => handleExternalLink(EXTERNAL_LINKS.github)}
              >
                GitHub
              </DropdownItem>
              <DropdownItem
                key="theme"
                startContent={mounted && (theme === 'dark' ? <LuSunMedium size={16} /> : <FaRegMoon size={14} />)}
                onClick={toggleTheme}
              >
                {mounted && (theme === 'dark' ? 'Light Theme' : 'Dark Theme')}
              </DropdownItem>
              <DropdownItem
                key="settings"
                startContent={<FiSettings className="h-4 w-4" />}
                onClick={() => handleNavigation('/settings')}
              >
                Settings
              </DropdownItem>
            </DropdownSection>
          </DropdownMenu>
        </Dropdown>
      </div>

      <div className="flex items-center">
        <AccountConnect />
      </div>
    </nav>
  );
}
