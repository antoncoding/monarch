import Image from 'next/image';
import type { Address } from 'viem';
import { getSlicedAddress } from '@/utils/address';

type AllocatorCardProps = {
  name: string;
  address: Address;
  description: string;
  image?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
};

export function AllocatorCard({
  name,
  address,
  description,
  image,
  isSelected = false,
  onSelect,
  disabled = false,
}: AllocatorCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full rounded border px-3 py-2.5 text-left transition-all duration-200 ease-in-out ${
        isSelected
          ? 'border-primary bg-primary/10 dark:bg-primary/20'
          : 'border-gray-100 bg-gray-50/50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900/50 dark:hover:border-gray-600'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {image && (
              <Image
                src={image}
                alt={name}
                width={20}
                height={20}
                className="rounded-full"
              />
            )}
            <span className="text-sm font-medium text-primary">{name}</span>
            <span className="text-xs text-tertiary">{getSlicedAddress(address)}</span>
          </div>
          {isSelected && (
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary">
              <svg
                className="h-2.5 w-2.5 text-white"
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
        <p className="text-xs text-secondary">{description}</p>
      </div>
    </button>
  );
}
