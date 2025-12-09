'use client';
import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { PiButterflyDuotone } from 'react-icons/pi';

import { cn } from '@/utils/components';

export type IconSwitchProps = {
  defaultSelected?: boolean;
  selected?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'accent' | 'destructive';
  onChange?: (selected: boolean) => void;
  thumbIcon?: React.ComponentType<{ className?: string }>;
  thumbIconOn?: React.ComponentType<{ className?: string }>;
  thumbIconOff?: React.ComponentType<{ className?: string }>;
  classNames?: {
    wrapper?: string;
    base?: string;
    thumb?: string;
    thumbIcon?: string;
  };
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'color'>;

type SizeConfig = {
  width: number;
  height: number;
  padding: number;
  thumbWidth: number;
  thumbHeight: number;
  radius: number;
  thumbRadius: number;
  iconClass: string;
};

const SIZE_CONFIG: Record<NonNullable<IconSwitchProps['size']>, SizeConfig> = {
  xs: {
    width: 38,
    height: 22,
    padding: 3,
    thumbWidth: 20,
    thumbHeight: 16,
    radius: 6,
    thumbRadius: 4,
    iconClass: 'text-[12px] leading-none',
  },
  sm: {
    width: 44,
    height: 26,
    padding: 4,
    thumbWidth: 20,
    thumbHeight: 18,
    radius: 7,
    thumbRadius: 5,
    iconClass: 'text-xs leading-none',
  },
  md: {
    width: 56,
    height: 30,
    padding: 4,
    thumbWidth: 24,
    thumbHeight: 22,
    radius: 8,
    thumbRadius: 6,
    iconClass: 'text-sm leading-none',
  },
  lg: {
    width: 72,
    height: 40,
    padding: 5,
    thumbWidth: 32,
    thumbHeight: 28,
    radius: 10,
    thumbRadius: 8,
    iconClass: 'text-base leading-none',
  },
};

const TRACK_COLOR: Record<NonNullable<IconSwitchProps['color']>, string> = {
  primary: 'bg-[var(--palette-orange)]',
  secondary: 'bg-[var(--color-background-secondary)]',
  accent: 'bg-[var(--palette-bg-hovered)]',
  destructive: 'bg-[#d92d20]',
};

export function IconSwitch({
  defaultSelected = false,
  selected: controlledSelected,
  size = 'sm',
  color = 'primary',
  onChange,
  thumbIcon: ThumbIcon = PiButterflyDuotone,
  thumbIconOn,
  thumbIconOff,
  classNames,
  disabled = false,
  className,
  ...rest
}: IconSwitchProps) {
  const [internalSelected, setInternalSelected] = useState(defaultSelected);

  const isControlled = controlledSelected !== undefined;
  const isSelected = isControlled ? controlledSelected : internalSelected;

  const config = SIZE_CONFIG[size];
  const translate = config.width - config.thumbWidth - config.padding * 2;

  // Determine which icon to use
  const IconComponent = thumbIconOn && thumbIconOff ? (isSelected ? thumbIconOn : thumbIconOff) : ThumbIcon;

  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newValue = !isSelected;
    if (!isControlled) {
      setInternalSelected(newValue);
    }
    onChange?.(newValue);
  }, [disabled, isControlled, isSelected, onChange]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle],
  );

  const { style: inlineStyle, ...buttonProps } = rest;

  const trackStyle: React.CSSProperties = {
    width: `${config.width}px`,
    height: `${config.height}px`,
    padding: `${config.padding}px`,
    borderRadius: `${config.radius}px`,
    ...inlineStyle,
  };

  const thumbStyle: React.CSSProperties = {
    width: `${config.thumbWidth}px`,
    height: `${config.thumbHeight}px`,
    borderRadius: `${config.thumbRadius}px`,
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isSelected}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-start overflow-hidden rounded-[8px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ring-1 ring-[var(--color-background-secondary)]',
        isSelected ? TRACK_COLOR[color] : 'bg-main',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        classNames?.base,
        classNames?.wrapper,
        className,
      )}
      style={trackStyle}
      {...buttonProps}
    >
      <motion.div
        className={cn(
          'flex items-center justify-center bg-surface shadow-sm ring-1 ring-[var(--color-background-secondary)]',
          classNames?.thumb,
        )}
        initial={false}
        animate={{
          x: isSelected ? translate : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
        style={thumbStyle}
      >
        <motion.div
          initial={false}
          className={cn(
            'flex items-center justify-center',
            config.iconClass,
            isSelected ? 'text-primary' : 'text-secondary',
            classNames?.thumbIcon,
          )}
        >
          <IconComponent className="h-[100%]" />
        </motion.div>
      </motion.div>
    </button>
  );
}
