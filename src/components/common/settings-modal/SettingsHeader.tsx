'use client';

import { ArrowLeftIcon, Cross2Icon } from '@radix-ui/react-icons';

type SettingsHeaderProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
};

export function SettingsHeader({ title, showBack, onBack, onClose }: SettingsHeaderProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface hover:text-primary"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
        )}
        <h2 className="font-zen text-lg text-primary">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface hover:text-primary"
        aria-label="Close settings"
      >
        <Cross2Icon className="h-4 w-4" />
      </button>
    </div>
  );
}
