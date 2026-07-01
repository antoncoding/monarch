'use client';

import { GearIcon } from '@radix-ui/react-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon } from 'react-icons/fa';
import { LuSunMedium } from 'react-icons/lu';
import { RiBookLine, RiBriefcaseLine, RiDiscordFill, RiLineChartLine, RiSafeLine, RiSwapLine } from 'react-icons/ri';
import { useConnection } from 'wagmi';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useModal } from '@/hooks/useModal';
import { EXTERNAL_LINKS } from '@/utils/external';

type HeaderMenuItemsProps = {
  iconSide?: 'start' | 'end';
  itemClassName?: string;
  onSelect?: () => void;
};

export function HeaderMenuItems({ iconSide = 'end', itemClassName, onSelect }: HeaderMenuItemsProps) {
  const router = useRouter();
  const { open: openModal } = useModal();
  const { address } = useConnection();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const positionsHref = mounted && address ? `/positions/${address}` : '/positions';
  const themeLabel = mounted && theme === 'dark' ? 'Light Theme' : 'Dark Theme';

  useEffect(() => {
    setMounted(true);
  }, []);

  const iconProps = (icon: ReactNode) => (iconSide === 'start' ? { startContent: icon } : { endContent: icon });

  const handleNavigation = (path: string) => {
    router.push(path);
    onSelect?.();
  };

  const handleExternalLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onSelect?.();
  };

  const handleSwap = () => {
    openModal('bridgeSwap', {});
    onSelect?.();
  };

  const handleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    onSelect?.();
  };

  const handleSettings = () => {
    openModal('monarchSettings', {});
    onSelect?.();
  };

  return (
    <>
      <DropdownMenuItem
        {...iconProps(<RiSwapLine className="h-4 w-4" />)}
        className={itemClassName}
        onClick={handleSwap}
      >
        Swap
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        {...iconProps(<RiLineChartLine className="h-4 w-4" />)}
        className={itemClassName}
        onClick={() => handleNavigation('/markets')}
      >
        Markets
      </DropdownMenuItem>
      <DropdownMenuItem
        {...iconProps(<RiBriefcaseLine className="h-4 w-4" />)}
        className={itemClassName}
        onClick={() => handleNavigation(positionsHref)}
      >
        Positions
      </DropdownMenuItem>
      <DropdownMenuItem
        {...iconProps(<RiSafeLine className="h-4 w-4" />)}
        className={itemClassName}
        onClick={() => handleNavigation('/autovault')}
      >
        Autovaults
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        {...iconProps(<RiBookLine className="h-4 w-4" />)}
        className={itemClassName}
        onClick={() => handleExternalLink(EXTERNAL_LINKS.docs)}
      >
        Docs
      </DropdownMenuItem>
      <DropdownMenuItem
        {...iconProps(<RiDiscordFill className="h-4 w-4" />)}
        className={itemClassName}
        onClick={() => handleExternalLink(EXTERNAL_LINKS.discord)}
      >
        Discord
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        {...iconProps(mounted ? theme === 'dark' ? <LuSunMedium size={16} /> : <FaRegMoon size={14} /> : undefined)}
        className={itemClassName}
        onClick={handleTheme}
      >
        {themeLabel}
      </DropdownMenuItem>
      <DropdownMenuItem
        {...iconProps(<GearIcon className="h-4 w-4" />)}
        className={itemClassName}
        onClick={handleSettings}
      >
        Settings
      </DropdownMenuItem>
    </>
  );
}
