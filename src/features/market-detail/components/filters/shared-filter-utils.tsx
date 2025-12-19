import type { ChangeEvent, ReactNode } from 'react';

/**
 * Shared SettingItem component for filter modals
 */
export function SettingItem({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-grow flex-col gap-1 pr-3">
        <h4 className="font-zen text-base font-medium text-primary">{title}</h4>
        <p className="font-zen text-xs text-secondary">{description}</p>
      </div>
      <div className="flex-shrink-0 pt-1">{children}</div>
    </div>
  );
}

/**
 * Creates a handler for numeric input fields that only allows valid decimal numbers
 * @param onChange Callback to invoke with the validated value
 * @returns Event handler for input change events
 */
export function createNumericInputHandler(onChange: (value: string) => void) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    // Allow empty string or valid decimal numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onChange(value);
    }
  };
}
