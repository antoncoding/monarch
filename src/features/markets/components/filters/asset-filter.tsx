'use client';
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { cn } from '@/utils/components';
import { type ERC20Token, type UnknownERC20Token, infoToKey } from '@/utils/tokens';

type FilterProps = {
  label: string;
  placeholder: string;
  selectedAssets: string[];
  setSelectedAssets: (assets: string[]) => void;
  items: (ERC20Token | UnknownERC20Token)[];
  loading: boolean;
  updateFromSearch?: string[];
  variant?: 'default' | 'compact';
  showLabelPrefix?: boolean;
};

export default function AssetFilter({
  label,
  placeholder,
  selectedAssets,
  setSelectedAssets,
  items,
  loading,
  updateFromSearch,
  variant = 'default',
  showLabelPrefix = false,
}: FilterProps) {
  const [query, setQuery] = useState('');
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

  const selectOption = (token: ERC20Token) => {
    const tokenKey = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
    if (selectedAssets.includes(tokenKey)) {
      setSelectedAssets(selectedAssets.filter((asset) => asset !== tokenKey));
    } else {
      setSelectedAssets([...selectedAssets, tokenKey]);
    }
    setQuery('');
  };

  const clearSelection = () => {
    setSelectedAssets([]);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      toggleDropdown();
    }
  };

  const filteredItems = items.filter((token) => token.symbol.toLowerCase().includes(query.toLowerCase()));
  const isCompact = variant === 'compact';

  useEffect(() => {
    if (updateFromSearch) {
      const newSelection = updateFromSearch
        .map((symbol) => items.find((item) => item.symbol.toLowerCase() === symbol.toLowerCase()))
        .filter(Boolean)
        .map((token) => token!.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|'));
      setSelectedAssets(newSelection);
    }
  }, [updateFromSearch, items, setSelectedAssets]);

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
            'min-w-[120px] max-w-[200px]',
            isOpen && 'min-w-[180px]',
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
              {showLabelPrefix && <span className="text-secondary">{label}:</span>}
              {loading ? (
                <span className="text-secondary">Loading...</span>
              ) : selectedAssets.length > 0 ? (
                <div className="flex items-center gap-1">
                  {selectedAssets.slice(0, 3).map((asset) => {
                    const token = items.find((item) => item.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|') === asset);
                    return token ? (
                      token.img ? (
                        <Image
                          key={asset}
                          src={token.img}
                          alt={token.symbol}
                          width={14}
                          height={14}
                        />
                      ) : (
                        <div
                          key={asset}
                          className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-gray-200 text-[10px] dark:bg-gray-700"
                        >
                          ?
                        </div>
                      )
                    ) : null;
                  })}
                  {selectedAssets.length > 3 && <span className="text-xs text-secondary">+{selectedAssets.length - 3}</span>}
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
            'bg-surface absolute z-50 mt-1 w-full rounded-sm shadow-lg transition-all duration-200',
            isOpen && !loading ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
          )}
        >
          <input
            aria-label="Search tokens"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full border-none bg-transparent p-2 text-sm text-primary placeholder:text-secondary outline-none focus:outline-none"
          />
          <div className="relative">
            <ul
              className="custom-scrollbar max-h-60 overflow-auto pb-10"
              role="listbox"
            >
              {filteredItems.map((token) => {
                const tokenKey = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
                return (
                  <li
                    key={tokenKey}
                    className={cn(
                      'm-2 flex cursor-pointer items-center justify-between rounded p-2 text-sm transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800',
                      selectedAssets.includes(tokenKey) && 'bg-gray-100 dark:bg-gray-800',
                    )}
                    onClick={() => selectOption(token)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        selectOption(token);
                      }
                    }}
                    role="option"
                    aria-selected={selectedAssets.includes(tokenKey)}
                    tabIndex={0}
                  >
                    <span title={token.symbol}>{token.symbol.length > 10 ? `${token.symbol.slice(0, 10)}...` : token.symbol}</span>
                    {token.img ? (
                      <Image
                        src={token.img}
                        alt={token.symbol}
                        width={16}
                        height={16}
                      />
                    ) : (
                      <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-gray-200 text-[10px] dark:bg-gray-700">
                        ?
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="bg-surface absolute bottom-0 left-0 right-0 border-gray-700 p-1.5">
              <button
                className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-left text-xs text-secondary transition-colors duration-200 hover:text-normal"
                onClick={clearSelection}
                type="button"
              >
                <span>Clear All</span>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
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
        className={cn(
          'bg-surface min-w-48 cursor-pointer rounded-sm p-2 shadow-sm transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700',
          isOpen && 'bg-gray-200 dark:bg-gray-700',
        )}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="absolute left-2 top-2 px-1 text-xs text-secondary font-zen">{label}</span>
        <div className="flex items-center justify-between pt-4">
          {loading ? (
            <span className="p-0.5 text-sm text-secondary font-zen">Loading...</span>
          ) : selectedAssets.length > 0 ? (
            <div className="flex-scroll flex gap-2 p-1 pb-0.5">
              {selectedAssets.map((asset) => {
                const token = items.find((item) => item.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|') === asset);
                return token ? (
                  token.img ? (
                    <Image
                      key={asset}
                      src={token.img}
                      alt={token.symbol}
                      width={18}
                      height={18}
                    />
                  ) : (
                    <div
                      key={asset}
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gray-200 text-xs dark:bg-gray-700"
                    >
                      ?
                    </div>
                  )
                ) : null;
              })}
            </div>
          ) : (
            <span className="p-[2px] text-sm text-secondary font-zen">{placeholder}</span>
          )}
          <ChevronDownIcon className={cn('transition-transform duration-300', isOpen && 'rotate-180')} />
        </div>
      </div>
      <div
        className={cn(
          'bg-surface absolute z-50 mt-1 w-full transform rounded-sm shadow-lg transition-all duration-200',
          isOpen && !loading ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
        )}
      >
        <input
          aria-label="Search tokens"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens..."
          className="w-full border-none bg-transparent p-3 text-sm text-primary placeholder:text-secondary font-zen outline-none focus:outline-none"
        />
        <div className="relative">
          <ul
            className="custom-scrollbar max-h-96 overflow-auto pb-12"
            role="listbox"
          >
            {filteredItems.map((token) => (
              <li
                key={token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|')}
                className={`m-2 flex cursor-pointer items-center justify-between rounded p-2 text-sm transition-colors duration-200 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                  selectedAssets.includes(token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|'))
                    ? 'bg-gray-300 dark:bg-gray-700'
                    : ''
                }`}
                onClick={() => selectOption(token)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    selectOption(token);
                  }
                }}
                role="option"
                aria-selected={selectedAssets.includes(token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|'))}
                tabIndex={0}
              >
                <span
                  className="font-zen text-primary"
                  title={token.symbol}
                >
                  {token.symbol.length > 8 ? `${token.symbol.slice(0, 8)}...` : token.symbol}
                </span>
                {token.img ? (
                  <Image
                    src={token.img}
                    alt={token.symbol}
                    width={18}
                    height={18}
                  />
                ) : (
                  <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gray-200 text-xs dark:bg-gray-700">
                    ?
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="bg-surface absolute bottom-0 left-0 right-0 border-gray-700 p-2">
            <button
              className="hover:bg-main flex w-full items-center justify-between rounded-sm p-2 text-left text-xs text-secondary transition-colors duration-200 hover:text-normal"
              onClick={clearSelection}
              type="button"
            >
              <span>Clear All</span>
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
