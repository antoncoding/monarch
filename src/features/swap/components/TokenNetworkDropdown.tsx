import { useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TokenIcon } from '@/components/shared/token-icon';
import { NetworkIcon } from '@/components/shared/network-icon';
import { getNetworkName } from '@/utils/networks';
import type { SwapToken } from '../types';

type TokenNetworkDropdownProps = {
  selectedToken: SwapToken | null;
  tokens: SwapToken[];
  onSelect: (token: SwapToken) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Optional chain ID to highlight tokens on (e.g., to show matching network) */
  highlightChainId?: number;
};

/**
 * Compact inline token + network selector for swap interface
 * Displays token icon with small network icon, opens searchable dropdown
 */
export function TokenNetworkDropdown({
  selectedToken,
  tokens,
  onSelect,
  placeholder = 'Select',
  disabled,
  highlightChainId,
}: TokenNetworkDropdownProps) {
  const [query, setQuery] = useState('');

  // Filter tokens by search query
  const filteredTokens = tokens
    .filter(
      (token) =>
        token.symbol.toLowerCase().includes(query.toLowerCase()) ||
        (getNetworkName(token.chainId)?.toLowerCase() ?? '').includes(query.toLowerCase()),
    )
    // Sort highlighted chain tokens first
    .sort((a, b) => {
      if (highlightChainId) {
        const aMatch = a.chainId === highlightChainId ? 0 : 1;
        const bMatch = b.chainId === highlightChainId ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return 0;
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-10 min-w-[120px] items-center gap-1.5 rounded-sm bg-hovered px-4 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selectedToken ? (
            <>
              <TokenIcon
                address={selectedToken.address}
                chainId={selectedToken.chainId}
                symbol={selectedToken.symbol}
                width={20}
                height={20}
              />
              <span className="font-medium">{selectedToken.symbol}</span>
              <NetworkIcon networkId={selectedToken.chainId} />
            </>
          ) : disabled ? (
            <span className="text-xs text-secondary">Loading...</span>
          ) : (
            <span className="text-xs text-secondary">{placeholder}</span>
          )}
          <ChevronDownIcon className="ml-1 h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 z-5000"
      >
        {/* Search input */}
        <div className="mb-2 border-b border-border pb-2">
          <input
            type="text"
            placeholder="Search tokens..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:opacity-50"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Token list */}
        <div className="max-h-80 overflow-y-auto">
          {filteredTokens.length === 0 ? (
            <div className="py-6 text-center text-sm opacity-50">No tokens found</div>
          ) : (
            filteredTokens.map((token) => (
              <DropdownMenuItem
                key={`${token.address}-${token.chainId}`}
                onClick={() => {
                  onSelect(token);
                  setQuery('');
                }}
                className="cursor-pointer"
                startContent={
                  <TokenIcon
                    address={token.address}
                    chainId={token.chainId}
                    symbol={token.symbol}
                    width={20}
                    height={20}
                  />
                }
                endContent={
                  token.balance !== undefined ? (
                    <span className="text-secondary text-xs">{Number(formatUnits(token.balance, token.decimals)).toFixed(4)}</span>
                  ) : null
                }
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{token.symbol}</span>
                  <div
                    className={`badge flex items-center gap-1 ${
                      highlightChainId && token.chainId === highlightChainId ? 'bg-green-100 dark:bg-green-900/30' : ''
                    }`}
                  >
                    <NetworkIcon networkId={token.chainId} />
                    <span className="text-xs">{getNetworkName(token.chainId)}</span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
