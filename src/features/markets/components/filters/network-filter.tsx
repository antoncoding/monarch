'use client';
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { cn } from '@/utils/components';
import { type SupportedNetworks, getNetworkImg, networks } from '@/utils/networks';

type FilterProps = {
  selectedNetwork: SupportedNetworks | null;
  setSelectedNetwork: (network: SupportedNetworks | null) => void;
  variant?: 'default' | 'compact';
  showLabelPrefix?: boolean;
};

export default function NetworkFilter({ setSelectedNetwork, selectedNetwork, variant = 'default', showLabelPrefix = false }: FilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const selectNetwork = (networkId: SupportedNetworks) => {
    setSelectedNetwork(networkId);
    setIsOpen(false);
  };

  const clearSelection = () => {
    setSelectedNetwork(null);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      toggleDropdown();
    }
  };

  const selectedNetworkData = networks.find((n) => n.network === selectedNetwork);
  const isCompact = variant === 'compact';

  // Compact variant
  if (isCompact) {
    return (
      <div
        className="relative font-zen"
        ref={dropdownRef}
      >
        <button
          type="button"
          className={cn(
            'bg-surface flex h-10 items-center gap-2 rounded-sm px-3 shadow-sm transition-all duration-200 hover:bg-hovered',
            'max-w-[200px]',
            isOpen ? 'min-w-[180px]' : 'min-w-[120px]',
          )}
          onClick={toggleDropdown}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDropdown();
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex flex-1 items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {showLabelPrefix && <span className="text-secondary">Network:</span>}
              {selectedNetworkData ? (
                <div className="flex items-center gap-1.5">
                  {selectedNetwork && getNetworkImg(selectedNetwork) && (
                    <Image
                      src={getNetworkImg(selectedNetwork)!}
                      alt={selectedNetworkData.name}
                      width={14}
                      height={14}
                    />
                  )}
                  <span className="text-primary">{selectedNetworkData.name}</span>
                </div>
              ) : (
                <span className="text-secondary">All</span>
              )}
            </div>
          </div>
          <ChevronDownIcon className={cn('h-4 w-4 text-secondary transition-transform duration-200', isOpen && 'rotate-180')} />
        </button>

        <div
          className={cn(
            'bg-surface absolute z-50 mt-1 min-w-full rounded-sm shadow-lg transition-all duration-200',
            isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
          )}
        >
          <ul
            className="custom-scrollbar max-h-60 overflow-auto"
            role="listbox"
          >
            {networks.map((network) => (
              <li
                key={network.network}
                className={cn(
                  'm-2 flex cursor-pointer items-center justify-between rounded p-2 text-sm transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800',
                  selectedNetwork === network.network && 'bg-gray-100 dark:bg-gray-800',
                )}
                onClick={() => selectNetwork(network.network)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    selectNetwork(network.network);
                  }
                }}
                role="option"
                aria-selected={selectedNetwork === network.network}
                tabIndex={0}
              >
                <span>{network.name}</span>
                <Image
                  src={network.logo}
                  alt={network.name}
                  width={16}
                  height={16}
                />
              </li>
            ))}
          </ul>
          {selectedNetwork && (
            <div className="bg-surface border-t border-border p-1.5">
              <button
                className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-left text-xs text-secondary transition-colors duration-200 hover:text-normal"
                onClick={clearSelection}
                type="button"
              >
                <span>Clear</span>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className="relative w-full"
      ref={dropdownRef}
    >
      <div
        className={`bg-surface min-w-48 cursor-pointer rounded-sm p-2 shadow-sm transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-gray-200 dark:bg-gray-700' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="absolute left-2 top-2 px-1 text-xs text-secondary font-zen">Network</span>
        <div className="flex items-center justify-between pt-4">
          {selectedNetworkData ? (
            <div className="flex items-center gap-2 p-1">
              {selectedNetwork && getNetworkImg(selectedNetwork) && (
                <Image
                  src={getNetworkImg(selectedNetwork)!}
                  alt={selectedNetworkData.name}
                  width={18}
                  height={18}
                />
              )}
              <span className="text-sm text-primary font-zen">{selectedNetworkData.name}</span>
            </div>
          ) : (
            <span className="p-[2px] text-sm text-secondary font-zen">All networks</span>
          )}
          <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </div>
      <div
        className={`bg-surface absolute z-50 mt-1 w-full transform rounded-sm shadow-lg transition-all duration-200 ${
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <div className="relative">
          <ul
            className="custom-scrollbar max-h-96 overflow-auto pb-12"
            role="listbox"
          >
            {networks.map((network) => (
              <li
                key={network.network}
                className={`m-2 flex cursor-pointer items-center justify-between rounded p-2 text-sm transition-colors duration-200 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                  selectedNetwork === network.network ? 'bg-gray-300 dark:bg-gray-700' : ''
                }`}
                onClick={() => selectNetwork(network.network)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    selectNetwork(network.network);
                  }
                }}
                role="option"
                aria-selected={selectedNetwork === network.network}
                tabIndex={0}
              >
                <span className="text-primary font-zen">{network.name}</span>
                <Image
                  src={network.logo}
                  alt={network.name}
                  width={18}
                  height={18}
                />
              </li>
            ))}
          </ul>
          <div className="bg-surface absolute bottom-0 left-0 right-0 border-gray-700 p-2">
            <button
              className="hover:bg-main flex w-full items-center justify-between rounded-sm p-2 text-left text-xs text-secondary transition-colors duration-200 hover:text-normal"
              onClick={clearSelection}
              type="button"
            >
              <span>Clear</span>
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
