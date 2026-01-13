'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { cn } from '@/utils/components';
import { type ERC20Token, type UnknownERC20Token, infoToKey } from '@/utils/tokens';

type AssetFilterProps = {
  label: string;
  placeholder: string;
  selectedAssets: string[];
  setSelectedAssets: (assets: string[]) => void;
  items: (ERC20Token | UnknownERC20Token)[];
  loading?: boolean;
  updateFromSearch?: string[];
  showLabelPrefix?: boolean;
};

export default function AssetFilter({
  label,
  placeholder,
  selectedAssets,
  setSelectedAssets,
  items,
  loading = false,
  updateFromSearch,
  showLabelPrefix = false,
}: AssetFilterProps) {
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTokenKey = (token: ERC20Token | UnknownERC20Token) => token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');

  const toggleDropdown = () => setIsOpen(!isOpen);

  const selectOption = (token: ERC20Token | UnknownERC20Token) => {
    const tokenKey = getTokenKey(token);
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

  const filteredItems = items.filter((token) => token.symbol.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (updateFromSearch) {
      const newSelection = updateFromSearch
        .map((symbol) => items.find((item) => item.symbol.toLowerCase() === symbol.toLowerCase()))
        .filter(Boolean)
        .map((token) => getTokenKey(token!));
      setSelectedAssets(newSelection);
    }
  }, [updateFromSearch, items, setSelectedAssets]);

  const renderTokenIcon = (token: ERC20Token | UnknownERC20Token, size: number) =>
    token.img ? (
      <Image
        src={token.img}
        alt={token.symbol}
        width={size}
        height={size}
      />
    ) : (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-gray-200 text-[10px] dark:bg-gray-700',
          size === 14 ? 'h-[14px] w-[14px]' : 'h-[16px] w-[16px]',
        )}
      >
        ?
      </div>
    );

  return (
    <div
      className="relative font-zen"
      ref={dropdownRef}
    >
      <button
        type="button"
        className={cn(
          'bg-surface flex h-10 items-center gap-2 rounded-sm px-3 shadow-sm transition-all duration-200 hover:bg-hovered',
          'min-w-[120px] max-w-[220px]',
          isOpen && 'min-w-[180px]',
        )}
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-1 items-center gap-2 text-sm">
          {showLabelPrefix && <span className="text-secondary">{label}:</span>}
          {loading ? (
            <span className="text-secondary">Loading...</span>
          ) : selectedAssets.length > 0 ? (
            <div className="flex items-center gap-1">
              {selectedAssets.slice(0, 3).map((asset) => {
                const token = items.find((item) => getTokenKey(item) === asset);
                return token ? <span key={asset}>{renderTokenIcon(token, 14)}</span> : null;
              })}
              {selectedAssets.length > 3 && <span className="text-xs text-secondary">+{selectedAssets.length - 3}</span>}
            </div>
          ) : (
            <span className="text-secondary">{placeholder}</span>
          )}
        </div>
        <ChevronDownIcon className={cn('h-4 w-4 text-secondary transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && !loading && (
        <div className="bg-surface absolute z-50 mt-1 w-full min-w-[180px] rounded-sm shadow-lg">
          <input
            aria-label="Search tokens"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full border-none bg-transparent p-2 text-sm text-primary placeholder:text-secondary outline-none"
          />
          <div className="relative">
            <ul
              className="custom-scrollbar max-h-60 overflow-auto pb-10"
              role="listbox"
            >
              {filteredItems.map((token) => {
                const tokenKey = getTokenKey(token);
                const isSelected = selectedAssets.includes(tokenKey);
                return (
                  <li
                    key={tokenKey}
                    className={cn(
                      'm-2 flex cursor-pointer items-center justify-between rounded p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800',
                      isSelected && 'bg-gray-100 dark:bg-gray-800',
                    )}
                    onClick={() => selectOption(token)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectOption(token)}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                  >
                    <span title={token.symbol}>{token.symbol.length > 10 ? `${token.symbol.slice(0, 10)}...` : token.symbol}</span>
                    {renderTokenIcon(token, 16)}
                  </li>
                );
              })}
            </ul>
            <div className="bg-surface absolute bottom-0 left-0 right-0 p-1.5">
              <button
                className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-xs text-secondary hover:text-normal"
                onClick={clearSelection}
                type="button"
              >
                <span>Clear All</span>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
