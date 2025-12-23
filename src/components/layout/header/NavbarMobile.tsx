'use client';

import { useEffect, useState } from 'react';
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
import { useConnection } from 'wagmi';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { EXTERNAL_LINKS } from '@/utils/external';
import logo from '../../imgs/logo.png';
import AccountConnect from './AccountConnect';

export default function NavbarMobile() {
  const { theme, setTheme } = useTheme();
  const { address } = useConnection();
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

        <DropdownMenu
          open={isMenuOpen}
          onOpenChange={setIsMenuOpen}
        >
          <DropdownMenuTrigger asChild>
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
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[200px]"
          >
            <DropdownMenuItem
              startContent={<RiLineChartLine className="h-5 w-5" />}
              onClick={() => handleNavigation('/markets')}
              className="py-3"
            >
              <span className="font-medium">Markets</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              startContent={<RiBriefcaseLine className="h-5 w-5" />}
              onClick={() => handleNavigation(address ? `/positions/${address}` : '/positions')}
              className="py-3"
            >
              <span className="font-medium">Portfolio</span>
            </DropdownMenuItem>
            {/* <DropdownMenuItem
              startContent={<RiSafeLine className="h-5 w-5" />}
              onClick={() => handleNavigation('/autovault')}
              className="py-3"
            >
              <span className="font-medium">Autovault</span>
            </DropdownMenuItem> */}
            <DropdownMenuItem
              startContent={<RiGiftLine className="h-5 w-5" />}
              onClick={() => handleNavigation(address ? `/rewards/${address}` : '/rewards')}
              className="py-3"
            >
              <span className="font-medium">Rewards</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              startContent={<RiBookLine className="h-4 w-4" />}
              onClick={() => handleExternalLink(EXTERNAL_LINKS.docs)}
            >
              Docs
            </DropdownMenuItem>
            <DropdownMenuItem
              startContent={<RiDiscordFill className="h-4 w-4" />}
              onClick={() => handleExternalLink(EXTERNAL_LINKS.discord)}
            >
              Discord
            </DropdownMenuItem>
            <DropdownMenuItem
              startContent={<RiGithubFill className="h-4 w-4" />}
              onClick={() => handleExternalLink(EXTERNAL_LINKS.github)}
            >
              GitHub
            </DropdownMenuItem>
            <DropdownMenuItem
              startContent={mounted && (theme === 'dark' ? <LuSunMedium size={16} /> : <FaRegMoon size={14} />)}
              onClick={toggleTheme}
            >
              {mounted && (theme === 'dark' ? 'Light Theme' : 'Dark Theme')}
            </DropdownMenuItem>
            <DropdownMenuItem
              startContent={<FiSettings className="h-4 w-4" />}
              onClick={() => handleNavigation('/settings')}
            >
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center">
        <AccountConnect />
      </div>
    </nav>
  );
}
