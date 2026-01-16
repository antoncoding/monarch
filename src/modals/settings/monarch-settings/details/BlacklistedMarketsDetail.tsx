'use client';

import { useMemo, useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Cross2Icon } from '@radix-ui/react-icons';
import { Divider } from '@/components/ui/divider';
import { Button } from '@/components/ui/button';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/features/markets/components/market-identity';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useBlacklistedMarkets } from '@/stores/useBlacklistedMarkets';
import { useStyledToast } from '@/hooks/useStyledToast';
import type { Market } from '@/utils/types';

const ITEMS_PER_PAGE = 20;

export function BlacklistedMarketsDetail() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { rawMarketsUnfiltered } = useProcessedMarkets();
  const { customBlacklistedMarkets, isBlacklisted, addBlacklistedMarket, removeBlacklistedMarket, isDefaultBlacklisted } =
    useBlacklistedMarkets();
  const { success: toastSuccess } = useStyledToast();

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const { blacklistedMarkets, availableMarkets } = useMemo(() => {
    const blacklisted: Market[] = [];
    const available: Market[] = [];

    rawMarketsUnfiltered.forEach((market) => {
      if (isBlacklisted(market.uniqueKey)) {
        blacklisted.push(market);
      } else {
        available.push(market);
      }
    });

    return {
      blacklistedMarkets: blacklisted.sort((a, b) => (a.loanAsset?.symbol ?? '').localeCompare(b.loanAsset?.symbol ?? '')),
      availableMarkets: available.sort((a, b) => (a.loanAsset?.symbol ?? '').localeCompare(b.loanAsset?.symbol ?? '')),
    };
  }, [rawMarketsUnfiltered, customBlacklistedMarkets, isBlacklisted]);

  const filteredAvailableMarkets = useMemo(() => {
    const query = searchQuery.trim();

    if (query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    return availableMarkets.filter((market) => {
      return (
        market.loanAsset?.symbol.toLowerCase().includes(lowerQuery) ||
        market.collateralAsset?.symbol.toLowerCase().includes(lowerQuery) ||
        market.uniqueKey.toLowerCase().includes(lowerQuery)
      );
    });
  }, [availableMarkets, searchQuery]);

  const totalPages = Math.ceil(filteredAvailableMarkets.length / ITEMS_PER_PAGE);
  const paginatedMarkets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAvailableMarkets.slice(startIndex, endIndex);
  }, [filteredAvailableMarkets, currentPage]);

  return (
    <div className="flex flex-col gap-4">
      {/* Blacklisted Markets Section */}
      {blacklistedMarkets.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-normal text-primary">Blacklisted Markets ({blacklistedMarkets.length})</h3>
          </div>

          <div className="flex flex-col gap-1.5 rounded bg-surface-soft p-3">
            {blacklistedMarkets.map((market) => {
              const isDefault = isDefaultBlacklisted(market.uniqueKey);

              return (
                <div
                  key={market.uniqueKey}
                  className="flex items-center justify-between gap-4 rounded bg-surface p-2 transition-colors hover:bg-surface-dark"
                >
                  <div className="flex flex-grow items-center gap-3">
                    <MarketIdentity
                      market={market}
                      chainId={market.morphoBlue.chain.id}
                      mode={MarketIdentityMode.Normal}
                      focus={MarketIdentityFocus.Loan}
                      showLltv
                      showId
                      showOracle={false}
                      iconSize={18}
                    />
                    {isDefault && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-400">Default</span>
                    )}
                  </div>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => {
                      removeBlacklistedMarket(market.uniqueKey);
                      toastSuccess('Market removed from blacklist', 'Market is now visible');
                    }}
                    disabled={isDefault}
                    className="shrink-0"
                  >
                    <Cross2Icon className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Divider />
        </>
      )}

      {/* Available Markets Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-normal text-primary">Add Markets to Blacklist</h3>
          {filteredAvailableMarkets.length > 0 && (
            <span className="text-[11px] text-secondary">
              {filteredAvailableMarkets.length} result{filteredAvailableMarkets.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <input
          type="text"
          placeholder="Search to add markets (min 2 characters)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-hovered h-9 w-full rounded p-2 font-zen text-xs focus:border-primary focus:outline-none"
        />
      </div>

      {/* Available Markets List */}
      <div className="flex flex-col gap-1.5 rounded bg-surface-soft font-zen">
        {searchQuery.trim().length === 0 ? (
          <div className="py-6 text-center text-xs text-secondary">Start typing to search for markets to blacklist.</div>
        ) : searchQuery.trim().length < 2 ? (
          <div className="py-6 text-center text-xs text-secondary">Type at least 2 characters to search.</div>
        ) : filteredAvailableMarkets.length === 0 ? (
          <div className="py-6 text-center text-xs text-secondary">No markets found matching &quot;{searchQuery}&quot;.</div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {paginatedMarkets.map((market) => {
                return (
                  <div
                    key={market.uniqueKey}
                    className="flex items-center justify-between gap-4 rounded bg-surface p-2.5 transition-colors hover:bg-surface-dark"
                  >
                    <div className="flex flex-grow items-center gap-3">
                      <MarketIdentity
                        market={market}
                        chainId={market.morphoBlue.chain.id}
                        mode={MarketIdentityMode.Normal}
                        focus={MarketIdentityFocus.Loan}
                        showLltv
                        showId
                        showOracle={false}
                        iconSize={18}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        const success = addBlacklistedMarket(market.uniqueKey, market.morphoBlue.chain.id);
                        if (success) {
                          toastSuccess('Market blacklisted', 'Market added to blacklist');
                        }
                      }}
                      className="shrink-0"
                    >
                      <FiPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
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
  );
}
