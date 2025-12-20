'use client';
import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { AiOutlineEnter } from 'react-icons/ai';
import { FaSearch } from 'react-icons/fa';
import { type ERC20Token, infoToKey, supportedTokens } from '@/utils/tokens';

type SearchProps = {
  onSearch: (query: string) => void;
  onFilterUpdate: (type: ShortcutType, tokens: string[]) => void;
  selectedCollaterals: string[];
  selectedLoanAssets: string[];
  searchQuery: string;
  uniqueCollaterals: ERC20Token[];
  uniqueLoanAssets: ERC20Token[];
};

export enum ShortcutType {
  Collateral = 'collateral',
  Loan = 'loan',
}

function AdvancedSearchBar({
  onSearch,
  onFilterUpdate,
  selectedCollaterals,
  selectedLoanAssets,
  searchQuery,
  uniqueCollaterals,
  uniqueLoanAssets,
}: SearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const searchKeys = Object.values(ShortcutType).map((type) => `${type}:`);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setSuggestions([]);
        setIsFilterMode(false);
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Only reset input value when all filters are removed and there's no custom search
    if (selectedCollaterals.length === 0 && selectedLoanAssets.length === 0 && !inputValue.trim()) {
      setInputValue('');
      onSearch('');
    }
  }, [selectedCollaterals, selectedLoanAssets, onSearch, inputValue]);

  const updateSuggestions = (value: string) => {
    let newSuggestions: string[] = [];

    // Add "Clean query" suggestion if there's an active search query and input is empty
    if (searchQuery && !value.trim()) {
      newSuggestions.push(`Clean query "${searchQuery}"`);
    }

    const lastWord = value.split(' ').pop() ?? '';
    if (searchKeys.some((key) => key.startsWith(lastWord))) {
      newSuggestions = [...newSuggestions, ...searchKeys.filter((key) => key.startsWith(lastWord))];
      setIsFilterMode(true);
    } else if (lastWord.includes(':')) {
      const [key, tokenQuery] = lastWord.split(':');
      const shortcutType = key as ShortcutType;
      const tokenList = shortcutType === ShortcutType.Collateral ? uniqueCollaterals : uniqueLoanAssets;
      const tokenSuggestions = tokenList
        .filter((token) => token.symbol.toLowerCase().startsWith(tokenQuery.toLowerCase()))
        .map((token) => `${key}:${token.symbol}`);
      newSuggestions = [...newSuggestions, ...tokenSuggestions];
      setIsFilterMode(true);
    } else if (value.trim() !== '') {
      newSuggestions.push(`Search "${value}" in all markets`);
      setIsFilterMode(false);
    }

    setSuggestions(newSuggestions);
    setSelectedSuggestion(-1);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setShowSuggestions(true);
    updateSuggestions(value);
  };

  const handleSearch = () => {
    // Clear any partial filter inputs
    const cleanedInput = inputValue
      .split(' ')
      .filter((word) => {
        // Keep words that are not partial filter inputs
        return !searchKeys.some((key) => word.startsWith(key.slice(0, -1)) && word !== key);
      })
      .join(' ');

    onSearch(cleanedInput);
    setInputValue(cleanedInput); // Update the input value to reflect the cleaned search
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const selectSuggestion = (suggestion: string) => {
    if (suggestion.startsWith('Clean query')) {
      handleSearch(); // This will clear the search query
    } else if (searchKeys.includes(suggestion)) {
      setInputValue(suggestion);
      updateSuggestions(suggestion);
    } else if (suggestion.includes(':')) {
      const [type, symbol] = suggestion.split(':');
      const shortcutType = type as ShortcutType;
      const tokenList = shortcutType === ShortcutType.Collateral ? uniqueCollaterals : uniqueLoanAssets;
      const token = tokenList.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
      if (token) {
        const tokenId = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
        const currentSelection = shortcutType === ShortcutType.Collateral ? selectedCollaterals : selectedLoanAssets;
        onFilterUpdate(shortcutType, [...currentSelection, tokenId]);
        setInputValue(''); // Clear the input after applying a filter
      }
    } else if (suggestion.startsWith('Search ')) {
      handleSearch();
    }
    setSuggestions([]);
    setIsFilterMode(false);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        selectSuggestion(suggestions[selectedSuggestion === -1 ? 0 : selectedSuggestion]);
      }
    } else if (e.key === 'Enter') {
      if (isFilterMode && selectedSuggestion !== -1) {
        selectSuggestion(suggestions[selectedSuggestion]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setIsFilterMode(false);
      setShowSuggestions(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion((prev) => (prev === suggestions.length - 1 ? 0 : prev + 1));
    }
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
    updateSuggestions(inputValue);
  };

  return (
    <div className="relative w-full">
      <div className="bg-surface min-w-48 cursor-text rounded-sm p-2 shadow-sm transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700">
        <span
          className="absolute left-2 top-2 px-1 text-xs font-zen"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Quick Search
        </span>
        <div className="flex items-center justify-between pt-4">
          <input
            ref={inputRef}
            id="market-search-input"
            type="text"
            placeholder="(Ctrl+F) Search markets or use shortcuts to filter"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            className="w-full bg-transparent text-sm text-primary placeholder:text-sm font-zen outline-none focus:outline-none"
            autoComplete="off"
          />
          <FaSearch
            className="ml-2 cursor-pointer flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={handleSearch}
          />
        </div>
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="bg-surface absolute z-50 mt-1 w-full rounded-sm shadow-lg"
        >
          <ul className="max-h-96 overflow-auto">
            {suggestions.map((suggestion, index) => {
              const isTokenSuggestion = suggestion.includes(':');
              const token = isTokenSuggestion ? supportedTokens.find((t) => t.symbol === suggestion.split(':')[1]) : null;

              return (
                <li
                  key={index}
                  className={`flex cursor-pointer items-center justify-between p-2 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                    index === selectedSuggestion ? 'bg-gray-300 dark:bg-gray-700' : ''
                  }`}
                  onClick={() => selectSuggestion(suggestion)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      selectSuggestion(suggestion);
                    }
                  }}
                  role="option"
                  tabIndex={0}
                  aria-selected={index === selectedSuggestion}
                >
                  <div className="flex items-center rounded-md bg-gray-200 px-2 py-1 text-xs dark:bg-gray-700">
                    {suggestion}
                    {isTokenSuggestion && token && token.img && (
                      <Image
                        src={token.img}
                        alt={suggestion.split(':')[1]}
                        width={12}
                        height={12}
                        className="ml-1"
                      />
                    )}
                  </div>
                  {(index === selectedSuggestion || suggestion.startsWith('Clean query') || suggestion.startsWith('Search ')) && (
                    <div className="flex items-center text-xs text-gray-500">
                      <AiOutlineEnter className="mr-1" />
                      <span>Enter</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AdvancedSearchBar;
