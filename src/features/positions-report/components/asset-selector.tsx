import { useRef, useState, useEffect } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import type { Address } from 'viem';
import { cn } from '@/utils/components';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TokenIcon } from '@/components/shared/token-icon';
import { getNetworkName } from '@/utils/networks';

export type AssetKey = {
  symbol: string;
  address: Address;
  chainId: number;
  decimals: number;
};

type AssetSelectorProps = {
  selectedAsset: AssetKey | null;
  assets: AssetKey[];
  onSelect: (asset: AssetKey) => void;
  variant?: 'default' | 'compact';
};

export function AssetSelector({ selectedAsset, assets, onSelect, variant = 'default' }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredAssets = assets.filter((asset) => asset.symbol.toLowerCase().includes(query.toLowerCase()));
  const isCompact = variant === 'compact';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compact variant
  if (isCompact) {
    return (
      <div
        className="relative min-w-[200px]"
        ref={dropdownRef}
      >
        <button
          className={cn(
            'bg-surface flex h-10 w-full items-center justify-between gap-2 rounded-sm px-3 shadow-sm transition-all duration-200 hover:bg-hovered',
          )}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen(!isOpen);
            } else if (e.key === 'Escape' && isOpen) {
              setIsOpen(false);
            }
          }}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="asset-selector-dropdown"
        >
          <div className="flex items-center gap-2 text-sm">
            {selectedAsset ? (
              <>
                <TokenIcon
                  address={selectedAsset.address}
                  chainId={selectedAsset.chainId}
                  symbol={selectedAsset.symbol}
                  width={16}
                  height={16}
                />
                <span>{selectedAsset.symbol}</span>
                <span className="badge text-xs">
                  <NetworkIcon networkId={selectedAsset.chainId} />
                  <span>{getNetworkName(selectedAsset.chainId)}</span>
                </span>
              </>
            ) : (
              <span className="text-secondary">Select asset...</span>
            )}
          </div>
          <ChevronDownIcon
            className={cn(
              'h-4 w-4 text-secondary transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </button>

        <div
          id="asset-selector-dropdown"
          role="listbox"
          className={cn(
            'bg-surface absolute z-10 mt-1 w-full overflow-hidden rounded-sm border shadow-lg transition-all duration-200 dark:border-gray-800',
            isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
          )}
          tabIndex={-1}
        >
          <div className="border-b border-gray-200 p-2 dark:border-gray-700">
            <input
              type="text"
              className="w-full bg-transparent p-1 text-sm outline-none placeholder:text-gray-500"
              placeholder="Search assets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredAssets.map((asset) => (
              <button
                type="button"
                key={`${asset.address}-${asset.chainId}`}
                role="option"
                aria-selected={selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId}
                className={cn(
                  'flex w-full items-center gap-2 p-2 text-left transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800',
                  selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId && 'bg-gray-50 dark:bg-gray-900',
                )}
                onClick={() => {
                  onSelect(asset);
                  setIsOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(asset);
                    setIsOpen(false);
                  }
                }}
              >
                <TokenIcon
                  address={asset.address}
                  chainId={asset.chainId}
                  symbol={asset.symbol}
                  width={20}
                  height={20}
                />
                <span className="font-medium">{asset.symbol}</span>
                <span className="badge text-xs">
                  <NetworkIcon networkId={asset.chainId} />
                  <span>{getNetworkName(asset.chainId)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default variant (original design)
  return (
    <div
      className="relative h-14 min-w-[200px]"
      ref={dropdownRef}
    >
      <button
        className="bg-surface relative flex h-14 w-full flex-col items-start justify-center rounded-sm px-4 shadow-sm"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          } else if (e.key === 'Escape' && isOpen) {
            setIsOpen(false);
          }
        }}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="asset-selector-dropdown"
      >
        <span className="absolute left-4 top-2 text-xs text-gray-500">Select Asset</span>
        <div className="flex w-full items-center justify-between pt-4">
          <div className="flex items-center gap-2">
            {selectedAsset && (
              <>
                <TokenIcon
                  address={selectedAsset.address}
                  chainId={selectedAsset.chainId}
                  symbol={selectedAsset.symbol}
                  width={20}
                  height={20}
                />
                <span>{selectedAsset.symbol}</span>
                <div className="badge">
                  <NetworkIcon networkId={selectedAsset.chainId} />
                  <span>{getNetworkName(selectedAsset.chainId)}</span>
                </div>
              </>
            )}
          </div>
          <ChevronDownIcon
            className={cn(
              'h-4 w-4 text-gray-500 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </button>

      <div
        id="asset-selector-dropdown"
        role="listbox"
        className={cn(
          'bg-surface absolute z-10 mt-1 w-full overflow-hidden rounded-sm border shadow-lg transition-all duration-200 dark:border-gray-800',
          isOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
        )}
        tabIndex={-1}
      >
        <div className="border-b border-gray-200 p-2 dark:border-gray-700">
          <input
            type="text"
            className="w-full bg-transparent p-1 text-sm outline-none placeholder:text-gray-500"
            placeholder="Search assets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredAssets.map((asset) => (
            <button
              type="button"
              key={`${asset.address}-${asset.chainId}`}
              role="option"
              aria-selected={selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId}
              className={cn(
                'flex w-full items-center gap-2 p-2 text-left transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800',
                selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId && 'bg-gray-50 dark:bg-gray-900',
              )}
              onClick={() => {
                onSelect(asset);
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(asset);
                  setIsOpen(false);
                }
              }}
            >
              <TokenIcon
                address={asset.address}
                chainId={asset.chainId}
                symbol={asset.symbol}
                width={20}
                height={20}
              />
              <span className="font-medium">{asset.symbol}</span>
              <div className="badge">
                <NetworkIcon networkId={asset.chainId} />
                <span>{getNetworkName(asset.chainId)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
