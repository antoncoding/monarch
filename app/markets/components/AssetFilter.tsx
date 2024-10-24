'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { ChevronDownIcon, TrashIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { ERC20Token, infoToKey } from '@/utils/tokens';

type FilterProps = {
  label: string;
  placeholder: string;
  selectedAssets: string[];
  setSelectedAssets: (assets: string[]) => void;
  items: ERC20Token[];
  loading: boolean;
};

export default function AssetFilter({
  label,
  placeholder,
  selectedAssets,
  setSelectedAssets,
  items,
  loading,
}: FilterProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Precompute a set of valid asset keys
  const validAssetKeys = new Set(
    items.map((item) => item.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|')),
  );
  const invalidSelection =
    !loading &&
    selectedAssets.length > 0 &&
    selectedAssets.every((asset) => !validAssetKeys.has(asset));

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

  const filteredItems = items.filter((token) =>
    token.symbol.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`min-w-48 cursor-pointer rounded-sm bg-secondary p-2 shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-secondary-dark' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="absolute left-2 top-2 px-1 text-xs">{label}</span>
        <div className="flex items-center justify-between pt-4">
          {loading ? (
            <span className="p-[2px] text-sm text-gray-400">Loading...</span>
          ) : invalidSelection ? (
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
              <span className="pt-[4px] text-sm text-yellow-500">Invalid</span>
            </div>
          ) : selectedAssets.length > 0 ? (
            <div className="flex-scroll flex gap-2 p-1 pb-[2px]">
              {selectedAssets.map((asset) => {
                const token = items.find(
                  (item) =>
                    item.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|') === asset,
                );
                return token?.img ? (
                  <Image key={asset} src={token.img} alt={token.symbol} width={18} height={18} />
                ) : null;
              })}
            </div>
          ) : (
            <span className="p-[2px] text-sm text-gray-400">{placeholder}</span>
          )}
          <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon />
          </span>
        </div>
      </div>
      {isOpen && !loading && (
        <div className="absolute z-10 mt-1 w-full rounded-sm bg-secondary shadow-lg">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tokens..."
            className="w-full border-none bg-transparent p-3 text-sm focus:outline-none"
          />
          <div className="relative">
            <ul className="custom-scrollbar max-h-60 overflow-auto pb-12" role="listbox">
              {filteredItems.map((token) => (
                <li
                  key={token.symbol}
                  className={`m-2 flex cursor-pointer items-center justify-between rounded-md p-2 text-sm hover:bg-gray-300 dark:hover:bg-gray-700 ${
                    selectedAssets.includes(
                      token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|'),
                    )
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
                  aria-selected={selectedAssets.includes(
                    token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|'),
                  )}
                  tabIndex={0}
                >
                  <span>{token.symbol}</span>
                  {token.img && <Image src={token.img} alt={token.symbol} width={18} height={18} />}
                </li>
              ))}
            </ul>
            <div className="absolute bottom-0 left-0 right-0 border-gray-700 bg-secondary p-2">
              <button
                className="flex w-full items-center justify-between rounded-sm p-2 text-left text-xs text-secondary hover:bg-primary"
                onClick={clearSelection}
                type="button"
              >
                <span>Clear All</span>
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
