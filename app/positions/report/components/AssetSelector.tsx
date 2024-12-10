import { useRef, useState, useEffect } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { Address } from 'viem';
import { NetworkIcon } from '@/components/common/NetworkIcon';
import { getNetworkName } from '@/utils/networks';

export type AssetKey = {
  symbol: string;
  address: Address;
  chainId: number;
  img?: string;
};

type AssetSelectorProps = {
  selectedAsset: AssetKey | null;
  assets: AssetKey[];
  onSelect: (asset: AssetKey) => void;
};

export function AssetSelector({ selectedAsset, assets, onSelect }: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredAssets = assets.filter((asset) =>
    asset.symbol.toLowerCase().includes(query.toLowerCase()),
  );

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

  return (
    <div className="relative h-14 min-w-[200px]" ref={dropdownRef}>
      <button
        className="bg-surface relative flex h-14 w-full flex-col items-start justify-center rounded rounded-sm px-4 shadow-sm"
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
                {selectedAsset.img && (
                  <Image
                    src={selectedAsset.img}
                    alt={selectedAsset.symbol}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                )}
                <span>{selectedAsset.symbol}</span>
                <div className="badge">
                  <NetworkIcon networkId={selectedAsset.chainId} />
                  <span>
                    {getNetworkName(selectedAsset.chainId)}
                  </span>
                </div>
              </>
            )}
          </div>
          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
        </div>
      </button>

      {isOpen && (
        <div
          id="asset-selector-dropdown"
          role="listbox"
          className="bg-surface absolute z-10 mt-1 w-full overflow-hidden rounded-sm border shadow-lg dark:border-gray-800"
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
                key={`${asset.symbol}-${asset.chainId}`}
                role="option"
                aria-selected={
                  selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId
                }
                className={`flex w-full items-center gap-2 p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  selectedAsset?.symbol === asset.symbol && selectedAsset?.chainId === asset.chainId
                    ? 'bg-gray-50 dark:bg-gray-900'
                    : ''
                }`}
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
                {asset.img && <Image src={asset.img} alt={asset.symbol} width={20} height={20} />}
                <span className="font-medium">{asset.symbol}</span>
                <div className="badge">
                  <NetworkIcon networkId={asset.chainId} />
                  <span>
                    {getNetworkName(asset.chainId)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
