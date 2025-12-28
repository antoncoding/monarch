'use client';
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { type ERC20Token, type UnknownERC20Token, infoToKey } from '@/utils/tokens';

type FilterProps = {
  label: string;
  placeholder: string;
  selectedAssets: string[];
  setSelectedAssets: (assets: string[]) => void;
  items: (ERC20Token | UnknownERC20Token)[];
  loading: boolean;
  updateFromSearch?: string[];
};

export default function AssetFilter({
  label,
  placeholder,
  selectedAssets,
  setSelectedAssets,
  items,
  loading,
  updateFromSearch,
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

  useEffect(() => {
    if (updateFromSearch) {
      const newSelection = updateFromSearch
        .map((symbol) => items.find((item) => item.symbol.toLowerCase() === symbol.toLowerCase()))
        .filter(Boolean)
        .map((token) => token!.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|'));
      setSelectedAssets(newSelection);
    }
  }, [updateFromSearch, items, setSelectedAssets]);

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
          <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </div>
      <div
        className={`bg-surface absolute z-50 mt-1 w-full transform rounded-sm shadow-lg transition-all duration-200 ${
          isOpen && !loading ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
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
