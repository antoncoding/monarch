'use client';

import { useCallback, useMemo, useState } from 'react';
import { Cross2Icon } from '@radix-ui/react-icons';
import { FiPlus } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/components/shared/token-icon';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useBlacklistedAssets, getAssetBlacklistKey, type BlacklistedAsset } from '@/stores/useBlacklistedAssets';
import type { TokenInfo } from '@/utils/types';

type AssetOption = {
  address: string;
  chainId: number;
  symbol: string;
  name: string;
  marketCount: number;
};

const ITEMS_PER_PAGE = 20;

const toAssetOption = (asset: TokenInfo, chainId: number): AssetOption => ({
  address: asset.address.toLowerCase(),
  chainId,
  symbol: asset.symbol,
  name: asset.name,
  marketCount: 0,
});

function AssetRow({ asset, action }: { asset: AssetOption | BlacklistedAsset; action: React.ReactNode }) {
  const name = asset.name || asset.symbol || 'Unknown asset';
  const symbol = asset.symbol || 'Unknown';
  const marketCount = 'marketCount' in asset ? asset.marketCount : undefined;

  return (
    <div className="flex items-center justify-between gap-4 rounded bg-surface-soft p-2.5 transition-colors hover:bg-surface-dark">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <TokenIcon
          address={asset.address}
          chainId={asset.chainId}
          width={22}
          height={22}
          symbol={symbol}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-primary">{symbol}</span>
            <span className="text-[11px] text-secondary">Chain {asset.chainId}</span>
          </div>
          <div className="truncate text-xs text-secondary">
            {name}
            {marketCount ? ` · ${marketCount} market${marketCount === 1 ? '' : 's'}` : ''}
          </div>
        </div>
      </div>
      {action}
    </div>
  );
}

export function BlacklistedAssetsDetail() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { rawMarketsUnfiltered } = useProcessedMarkets();
  const { customBlacklistedAssets, addBlacklistedAsset, removeBlacklistedAsset, isAssetBlacklisted } = useBlacklistedAssets();
  const { success: toastSuccess } = useStyledToast();

  const availableAssets = useMemo(() => {
    const assets = new Map<string, AssetOption>();

    for (const market of rawMarketsUnfiltered) {
      const chainId = market.morphoBlue.chain.id;

      for (const token of [market.loanAsset, market.collateralAsset]) {
        const key = getAssetBlacklistKey(chainId, token.address);
        const existing = assets.get(key) ?? toAssetOption(token, chainId);
        existing.marketCount += 1;
        assets.set(key, existing);
      }
    }

    return Array.from(assets.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [rawMarketsUnfiltered]);

  const blacklistedAssets = useMemo(() => {
    const metadataByKey = new Map(availableAssets.map((asset) => [getAssetBlacklistKey(asset.chainId, asset.address), asset]));

    return customBlacklistedAssets
      .map((asset) => ({ ...asset, ...metadataByKey.get(getAssetBlacklistKey(asset.chainId, asset.address)) }))
      .sort((a, b) => (a.symbol ?? '').localeCompare(b.symbol ?? ''));
  }, [availableAssets, customBlacklistedAssets]);

  const filteredAvailableAssets = useMemo(() => {
    const query = searchQuery.trim();

    if (query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    return availableAssets.filter((asset) => {
      if (isAssetBlacklisted(asset.chainId, asset.address)) return false;

      return (
        asset.symbol.toLowerCase().includes(lowerQuery) ||
        asset.name.toLowerCase().includes(lowerQuery) ||
        asset.address.toLowerCase().includes(lowerQuery)
      );
    });
  }, [availableAssets, isAssetBlacklisted, searchQuery]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.ceil(filteredAvailableAssets.length / ITEMS_PER_PAGE);
  const paginatedAssets = filteredAvailableAssets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const trimmedQuery = searchQuery.trim();
  const searchPlaceholder =
    trimmedQuery.length === 0
      ? 'Search by symbol, name, or address to hide every market using that asset.'
      : trimmedQuery.length < 2
        ? 'Type at least 2 characters to search.'
        : filteredAvailableAssets.length === 0
          ? `No assets found matching "${searchQuery}".`
          : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded bg-surface p-4">
        <p className="text-sm text-primary">Hide markets by token instead of by market ID.</p>
        <p className="mt-1 text-xs text-secondary">
          If an asset is blacklisted, markets using it as either loan or collateral are hidden from market lists.
        </p>
      </div>

      {blacklistedAssets.length > 0 && (
        <div className="flex flex-col gap-4 rounded bg-surface p-4">
          <h3 className="text-xs uppercase text-secondary">Blacklisted Assets ({blacklistedAssets.length})</h3>
          <div className="flex flex-col gap-1.5">
            {blacklistedAssets.map((asset) => (
              <AssetRow
                key={getAssetBlacklistKey(asset.chainId, asset.address)}
                asset={asset}
                action={
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => {
                      removeBlacklistedAsset(asset.chainId, asset.address);
                      toastSuccess('Asset removed from blacklist', `${asset.symbol ?? 'Asset'} markets are now visible`);
                    }}
                    className="shrink-0"
                  >
                    <Cross2Icon className="h-3 w-3" />
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Add Asset to Blacklist</h3>
        <input
          type="text"
          placeholder="Search assets (min 2 characters)..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="bg-hovered h-9 w-full rounded p-2 font-zen text-xs focus:border-primary focus:outline-none"
        />
        {filteredAvailableAssets.length > 0 && (
          <span className="text-[11px] text-secondary">
            {filteredAvailableAssets.length} result{filteredAvailableAssets.length === 1 ? '' : 's'}
          </span>
        )}

        <div className="flex flex-col gap-1.5">
          {searchPlaceholder ? (
            <div className="py-6 text-center text-xs text-secondary">{searchPlaceholder}</div>
          ) : (
            <>
              {paginatedAssets.map((asset) => (
                <AssetRow
                  key={getAssetBlacklistKey(asset.chainId, asset.address)}
                  asset={asset}
                  action={
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => {
                        const success = addBlacklistedAsset(asset);
                        if (success) {
                          toastSuccess('Asset blacklisted', `${asset.symbol} markets are now hidden`);
                        }
                      }}
                      className="shrink-0"
                    >
                      <FiPlus className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              ))}

              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-[11px] text-secondary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
