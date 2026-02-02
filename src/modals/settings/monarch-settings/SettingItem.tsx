'use client';

import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { IconSwitch } from '@/components/ui/icon-switch';
import { Button } from '@/components/ui/button';

type SettingToggleItemProps = {
  title: string;
  description: string | ReactNode;
  selected: boolean;
  onChange: (value: boolean) => void;
  ariaLabel: string;
  thumbIconOn?: IconType;
  thumbIconOff?: IconType;
  badge?: ReactNode;
  disabled?: boolean;
  color?: 'primary' | 'secondary' | 'accent' | 'destructive' | 'success';
};

export function SettingToggleItem({
  title,
  description,
  selected,
  onChange,
  ariaLabel,
  thumbIconOn,
  thumbIconOff,
  badge,
  disabled,
  color = 'primary',
}: SettingToggleItemProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-primary">{title}</h3>
          {badge}
        </div>
        <div className="text-xs text-secondary">{description}</div>
      </div>
      <IconSwitch
        selected={selected}
        onChange={onChange}
        size="xs"
        color={color}
        thumbIconOn={thumbIconOn}
        thumbIconOff={thumbIconOff}
        aria-label={ariaLabel}
        disabled={disabled}
        className="shrink-0"
      />
    </div>
  );
}

type SettingActionItemProps = {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  badge?: ReactNode;
};

export function SettingActionItem({ title, description, buttonLabel, onClick, badge }: SettingActionItemProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-primary">{title}</h3>
          {badge}
        </div>
        <p className="text-xs text-secondary">{description}</p>
      </div>
      <Button
        size="sm"
        variant="default"
        onClick={onClick}
        className="shrink-0"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

type SettingInputItemProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function SettingInputItem({ title, description, children }: SettingInputItemProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <h3 className="text-sm font-medium text-primary">{title}</h3>
        <p className="text-xs text-secondary">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
