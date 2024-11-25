'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ERC20Token, infoToKey } from '@/utils/tokens';

type FilterProps = {
  label: string;
  placeholder: string;
  selectedAssets: string[];
  setSelectedAssets: (assets: string[]) => void;
  items: ERC20Token[];
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

  const filteredItems = items.filter((token) =>
    token.symbol.toLowerCase().includes(query.toLowerCase()),
  );

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
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`bg-surface min-w-48 cursor-pointer rounded-sm p-2 shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-surface-dark' : ''
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
      <AnimatePresence>
        {isOpen && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="bg-surface absolute z-10 mt-1 w-full rounded-sm shadow-lg"
          >
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
                    {token.img && (
                      <Image src={token.img} alt={token.symbol} width={18} height={18} />
                    )}
                  </li>
                ))}
              </ul>
              <div className="bg-surface absolute bottom-0 left-0 right-0 border-gray-700 p-2">
                <button
                  className="hover:bg-main flex w-full items-center justify-between rounded-sm p-2 text-left text-xs text-secondary"
                  onClick={clearSelection}
                  type="button"
                >
                  <span>Clear All</span>
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
