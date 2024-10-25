'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@nextui-org/input';
import Image from 'next/image';
import { AiOutlineEnter } from 'react-icons/ai';
import { FaSearch } from 'react-icons/fa';
import { supportedTokens, infoToKey } from '@/utils/tokens';

type SearchProps = {
  onSearch: (query: string) => void;
  onFilterUpdate: (type: 'collateral' | 'loan', tokens: string[]) => void;
  selectedCollaterals: string[];
  selectedLoanAssets: string[];
  searchQuery: string; // currently active search query
};

function AdvancedSearchBar ({
  onSearch,
  onFilterUpdate,
  selectedCollaterals,
  selectedLoanAssets,
  searchQuery,
}: SearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const searchKeys = ['collateral:', 'loan:'];

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
      const tokenSuggestions = supportedTokens
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

    console.log('searching cleanedInput', cleanedInput);
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
      const token = supportedTokens.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
      if (token) {
        const tokenId = token.networks.map((n) => infoToKey(n.address, n.chain.id)).join('|');
        onFilterUpdate(type as 'collateral' | 'loan', [
          ...(type === 'collateral' ? selectedCollaterals : selectedLoanAssets),
          tokenId,
        ]);
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
      <Input
        ref={inputRef}
        id="market-search-input"
        label="Quick Search"
        placeholder="(Ctrl+F) Search markets or use shortcuts to filter"
        value={inputValue}
        onValueChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        endContent={<FaSearch className="cursor-pointer text-secondary" onClick={handleSearch} />}
        classNames={{
          inputWrapper: 'bg-secondary rounded-sm w-full lg:w-[600px]',
          input: 'bg-secondary rounded-sm text-xs',
        }}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full max-w-[400px] rounded-sm bg-secondary shadow-lg"
        >
          <ul className="max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => {
              console.log('suggestion', suggestion);
              const isTokenSuggestion = suggestion.includes(':');
              const token = isTokenSuggestion
                ? supportedTokens.find((t) => t.symbol === suggestion.split(':')[1])
                : null;

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
                  {(index === selectedSuggestion ||
                    suggestion.startsWith('Clean query') ||
                    suggestion.startsWith('Search ')) && (
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
};

export default AdvancedSearchBar;
