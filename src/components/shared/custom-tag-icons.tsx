'use client';

import type { IconType } from 'react-icons';
import { AiOutlineStar, AiOutlineThunderbolt, AiOutlineEye, AiOutlineHeart, AiOutlineRocket } from 'react-icons/ai';
import { BiTargetLock, BiBookmark, BiFlag } from 'react-icons/bi';
import { FaGem, FaChartLine } from 'react-icons/fa';
import type { CustomTagIconId } from '@/stores/useMarketPreferences';

/**
 * Mapping of icon IDs to react-icons components.
 * Keep this in sync with CUSTOM_TAG_ICONS in useMarketPreferences.
 */
export const ICON_MAP: Record<CustomTagIconId, IconType> = {
  star: AiOutlineStar,
  bookmark: BiBookmark,
  flag: BiFlag,
  target: BiTargetLock,
  eye: AiOutlineEye,
  gem: FaGem,
  bolt: AiOutlineThunderbolt,
  chart: FaChartLine,
  rocket: AiOutlineRocket,
  heart: AiOutlineHeart,
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
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(ICON_MAP) as CustomTagIconId[]).map((iconId) => {
        const IconComponent = ICON_MAP[iconId];
        const isSelected = iconId === selectedIcon;

        return (
          <button
            key={iconId}
            type="button"
            onClick={() => onSelect(iconId)}
            disabled={disabled}
            className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all ${
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-secondary hover:border-primary/50 hover:text-primary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            title={iconId}
          >
            <IconComponent size={16} />
          </button>
        );
      })}
    </div>
  );
}
