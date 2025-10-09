import React from 'react';
import { Address } from 'viem';
import { AddressDisplay } from './AddressDisplay';

type AllocatorCardProps = {
  name: string;
  address: Address;
  description: string;
  isSelected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
};

export function AllocatorCard({
  name,
  address,
  description,
  isSelected = false,
  onSelect,
  disabled = false,
}: AllocatorCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full rounded border p-4 text-left transition-all duration-200 ease-in-out ${
        isSelected
          ? 'border-primary bg-primary/10 dark:bg-primary/20'
          : 'border-gray-100 bg-gray-50/50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/50 dark:hover:border-gray-600'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-primary">{name}</h4>
          {isSelected && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
              <svg
                className="h-3 w-3 text-white"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        <div className="text-xs text-secondary">
          <AddressDisplay address={address} />
        </div>
        <p className="text-sm text-secondary">{description}</p>
      </div>
    </button>
  );
}
