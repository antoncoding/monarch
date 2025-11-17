import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, TrashIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { IoHelpCircleOutline } from 'react-icons/io5';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import { ERC20Token, UnknownERC20Token, infoToKey } from '@/utils/tokens';

type CollateralFilterProps = {
  selectedCollaterals: string[];
  setSelectedCollaterals: (collaterals: string[]) => void;
  availableCollaterals: (ERC20Token | UnknownERC20Token)[];
}

export const CollateralFilter = React.memo(({
  selectedCollaterals,
  setSelectedCollaterals,
  availableCollaterals,
}: CollateralFilterProps) => {
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

  const selectOption = (token: ERC20Token | UnknownERC20Token) => {
    const tokenKey = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
    if (selectedCollaterals.includes(tokenKey)) {
      setSelectedCollaterals(selectedCollaterals.filter((c) => c !== tokenKey));
    } else {
      setSelectedCollaterals([...selectedCollaterals, tokenKey]);
    }
  };

  const clearSelection = () => {
    setSelectedCollaterals([]);
    setQuery('');
    setIsOpen(false);
  };

  const filteredItems = availableCollaterals.filter((token) =>
    token.symbol.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative z-30 w-full" ref={dropdownRef}>
      <div
        className={`min-w-32 cursor-pointer rounded-sm bg-surface p-2 text-sm shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-surface-dark' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleDropdown();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          {selectedCollaterals.length > 0 ? (
            <div className="flex-scroll flex gap-1.5">
              {selectedCollaterals.map((key) => {
                const token = availableCollaterals.find(
                  (item) => item.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|') === key,
                );
                return token ? (
                  token.img ? (
                    <Image key={key} src={token.img} alt={token.symbol} width={14} height={14} />
                  ) : (
                    <div
                      key={key}
                      className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-gray-200 text-[10px] dark:bg-gray-700"
                    >
                      ?
                    </div>
                  )
                ) : null;
              })}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Filter collaterals</span>
          )}
          <span className={`ml-auto transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full rounded-sm bg-surface shadow-lg"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full border-none bg-transparent p-2 text-xs focus:outline-none"
            />
            <div className="relative">
              <ul className="custom-scrollbar max-h-60 overflow-auto pb-10" role="listbox">
                {filteredItems.map((token) => {
                  const tokenKey = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
                  return (
                    <li
                      key={tokenKey}
                      className={`m-2 flex cursor-pointer items-center justify-between rounded-md p-2 text-xs hover:bg-gray-300 dark:hover:bg-gray-700 ${
                        selectedCollaterals.includes(tokenKey)
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
                      aria-selected={selectedCollaterals.includes(tokenKey)}
                      tabIndex={0}
                    >
                      <span title={token.symbol}>
                        {token.symbol.length > 8 ? `${token.symbol.slice(0, 8)}...` : token.symbol}
                      </span>
                      {token.img ? (
                        <Image src={token.img} alt={token.symbol} width={14} height={14} />
                      ) : (
                        <div className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-gray-200 text-[10px] dark:bg-gray-700">
                          ?
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="absolute bottom-0 left-0 right-0 border-gray-700 bg-surface p-1.5">
                <button
                  className="hover:bg-main flex w-full items-center justify-between rounded-sm p-1.5 text-left text-[10px] text-secondary"
                  onClick={clearSelection}
                  type="button"
                >
                  <span>Clear All</span>
                  <TrashIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

CollateralFilter.displayName = 'CollateralFilter';

type OracleFilterProps = {
  selectedOracles: PriceFeedVendors[];
  setSelectedOracles: (oracles: PriceFeedVendors[]) => void;
  availableOracles: PriceFeedVendors[];
}

export const OracleFilter = React.memo(({
  selectedOracles,
  setSelectedOracles,
  availableOracles,
}: OracleFilterProps) => {
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

  const toggleOracle = (oracle: PriceFeedVendors) => {
    if (selectedOracles.includes(oracle)) {
      setSelectedOracles(selectedOracles.filter((o) => o !== oracle));
    } else {
      setSelectedOracles([...selectedOracles, oracle]);
    }
  };

  return (
    <div className="relative z-30 w-full" ref={dropdownRef}>
      <div
        className={`min-w-32 cursor-pointer rounded-sm bg-surface p-2 text-sm shadow-sm transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isOpen ? 'bg-gray-200 dark:bg-gray-700' : ''
        }`}
        role="button"
        tabIndex={0}
        onClick={toggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleDropdown();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          {selectedOracles.length > 0 ? (
            <div className="flex-scroll flex gap-1.5">
              {selectedOracles.map((oracle, index) => (
                <div key={index}>
                  {OracleVendorIcons[oracle] ? (
                    <Image src={OracleVendorIcons[oracle]} alt={oracle} height={14} width={14} />
                  ) : (
                    <IoHelpCircleOutline className="text-secondary" size={14} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Filter oracles</span>
          )}
          <span className={`ml-auto transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDownIcon className="h-3 w-3" />
          </span>
        </div>
      </div>
      <div
        className={`absolute z-50 mt-1 w-full transform rounded-sm bg-surface shadow-lg transition-all duration-200 ${
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <ul className="custom-scrollbar max-h-60 overflow-auto" role="listbox">
          {availableOracles.map((oracle) => (
            <li
              key={oracle}
              className={`m-2 flex cursor-pointer items-center justify-between rounded p-1.5 text-xs transition-colors duration-200 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                selectedOracles.includes(oracle) ? 'bg-gray-300 dark:bg-gray-700' : ''
              }`}
              onClick={() => toggleOracle(oracle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleOracle(oracle);
                }
              }}
              role="option"
              aria-selected={selectedOracles.includes(oracle)}
              tabIndex={0}
            >
              <div className="flex items-center gap-2">
                {OracleVendorIcons[oracle] ? (
                  <Image
                    src={OracleVendorIcons[oracle]}
                    alt={oracle}
                    width={14}
                    height={14}
                    className="rounded-full"
                  />
                ) : (
                  <IoHelpCircleOutline className="text-secondary" size={14} />
                )}
                <span>{oracle === PriceFeedVendors.Unknown ? 'Unknown Feed' : oracle}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});

OracleFilter.displayName = 'OracleFilter';
