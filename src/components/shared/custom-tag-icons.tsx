'use client';

import type { IconType } from 'react-icons';
import { AiOutlineFire, AiOutlineRocket, AiOutlineStar, AiOutlineThunderbolt, AiOutlineEye, AiOutlineHeart, AiOutlineTrophy, AiOutlineCrown } from 'react-icons/ai';
import { BiTrendingUp, BiTargetLock, BiBookmark, BiFlag } from 'react-icons/bi';
import { FaGem, FaCoins, FaBolt, FaChartLine } from 'react-icons/fa';
import { HiOutlineSparkles, HiOutlineLightningBolt } from 'react-icons/hi';
import { IoFlameOutline, IoDiamondOutline } from 'react-icons/io5';
import type { CustomTagIconId } from '@/stores/useMarketPreferences';

/**
 * Mapping of icon IDs to react-icons components.
 * Keep this in sync with CUSTOM_TAG_ICONS in useMarketPreferences.
 */
export const ICON_MAP: Record<CustomTagIconId, IconType> = {
  fire: AiOutlineFire,
  rocket: AiOutlineRocket,
  star: AiOutlineStar,
  bolt: AiOutlineThunderbolt,
  gem: FaGem,
  chart: FaChartLine,
  target: BiTargetLock,
  eye: AiOutlineEye,
  bookmark: BiBookmark,
  flag: BiFlag,
  heart: AiOutlineHeart,
  coins: FaCoins,
  trophy: AiOutlineTrophy,
  zap: FaBolt,
  trending: BiTrendingUp,
  sparkles: HiOutlineSparkles,
  flame: IoFlameOutline,
  diamond: IoDiamondOutline,
  crown: AiOutlineCrown,
  lightning: HiOutlineLightningBolt,
};

type CustomTagIconProps = {
  iconId: CustomTagIconId;
  size?: number;
  className?: string;
};

/**
 * Render a custom tag icon by its ID.
 */
export function CustomTagIcon({ iconId, size = 14, className = '' }: CustomTagIconProps) {
  const IconComponent = ICON_MAP[iconId];
  if (!IconComponent) return null;
  return <IconComponent size={size} className={className} />;
}

/**
 * Icon picker component for selecting custom tag icons.
 */
type IconPickerProps = {
  selectedIcon: CustomTagIconId;
  onSelect: (icon: CustomTagIconId) => void;
  disabled?: boolean;
};

export function CustomTagIconPicker({ selectedIcon, onSelect, disabled = false }: IconPickerProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(ICON_MAP) as CustomTagIconId[]).map((iconId) => {
        const IconComponent = ICON_MAP[iconId];
        const isSelected = iconId === selectedIcon;

        return (
          <button
            key={iconId}
            type="button"
            onClick={() => onSelect(iconId)}
            disabled={disabled}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
              isSelected
                ? 'bg-primary/20 ring-2 ring-primary text-primary'
                : 'bg-surface hover:bg-default-100 text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={iconId}
          >
            <IconComponent size={16} />
          </button>
        );
      })}
    </div>
  );
}
