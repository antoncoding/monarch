import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TokenIcon } from '@/components/shared/token-icon';
import { getNetworkName } from '@/utils/networks';
import type { SwapToken } from '../types';

type TokenSelectorProps = {
  label: string;
  selectedToken: SwapToken | null;
  tokens: SwapToken[];
  onSelect: (token: SwapToken) => void;
  disabled?: boolean;
};

export function TokenSelector({ label, selectedToken, tokens, onSelect, disabled }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tokens by search query
  const filteredTokens = tokens.filter((token) => token.symbol.toLowerCase().includes(query.toLowerCase()));

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <div className="mb-1 text-xs text-secondary">{label}</div>
      <button
        type="button"
        className="bg-hovered relative flex h-14 w-full items-center justify-between rounded-sm px-4 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {selectedToken ? (
          <div className="flex items-center gap-2">
            <TokenIcon
              address={selectedToken.address}
              chainId={selectedToken.chainId}
              symbol={selectedToken.symbol}
              width={20}
              height={20}
            />
            <span className="font-medium">{selectedToken.symbol}</span>
            <div className="badge flex items-center gap-1">
              <NetworkIcon networkId={selectedToken.chainId} />
              <span className="text-xs">{getNetworkName(selectedToken.chainId)}</span>
            </div>
            {selectedToken.balance !== undefined && (
              <span className="text-secondary ml-auto text-sm">
                {Number(formatUnits(selectedToken.balance, selectedToken.decimals)).toFixed(4)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-secondary">Select token</span>
        )}
        <ChevronDownIcon className="text-secondary ml-2 h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="bg-surface absolute z-10 mt-1 w-full overflow-hidden rounded-sm border shadow-lg dark:border-gray-800"
        >
          {/* Search input */}
          <div className="border-b border-gray-200 p-2 dark:border-gray-700">
            <input
              type="text"
              className="w-full bg-transparent p-1 text-sm outline-none placeholder:text-gray-500"
              placeholder="Search tokens..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  setIsOpen(false);
                  setQuery('');
                }
              }}
            />
          </div>

          {/* Token list */}
          <div className="max-h-80 overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <div className="text-secondary p-4 text-center text-sm">No tokens found</div>
            ) : (
              filteredTokens.map((token) => (
                <button
                  type="button"
                  key={`${token.address}-${token.chainId}`}
                  role="option"
                  aria-selected={
                    selectedToken?.address === token.address && selectedToken?.chainId === token.chainId
                  }
                  className={`flex w-full items-center gap-2 p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    selectedToken?.address === token.address && selectedToken?.chainId === token.chainId
                      ? 'bg-gray-50 dark:bg-gray-900'
                      : ''
                  }`}
                  onClick={() => {
                    onSelect(token);
                    setIsOpen(false);
                    setQuery('');
                  }}
                >
                  <TokenIcon
                    address={token.address}
                    chainId={token.chainId}
                    symbol={token.symbol}
                    width={20}
                    height={20}
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.symbol}</span>
                      <div className="badge flex items-center gap-1">
                        <NetworkIcon networkId={token.chainId} />
                        <span className="text-xs">{getNetworkName(token.chainId)}</span>
                      </div>
                    </div>
                    {token.balance !== undefined && (
                      <span className="text-secondary text-sm">
                        {Number(formatUnits(token.balance, token.decimals)).toFixed(4)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
