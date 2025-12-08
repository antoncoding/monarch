'use client';

import React, { useMemo } from 'react';
import { Divider } from '@heroui/react';
import { FiPlus, FiX } from 'react-icons/fi';
import { MdBlockFlipped } from 'react-icons/md';
import { Button } from '@/components/common';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/components/MarketIdentity';
import { useMarkets } from '@/contexts/MarketsContext';
import type { Market } from '@/utils/types';

type BlacklistedMarketsModalProps = {
  isOpen: boolean;
  onOpenChange: (opened: boolean) => void;
};

const ITEMS_PER_PAGE = 20;

export function BlacklistedMarketsModal({ isOpen, onOpenChange }: BlacklistedMarketsModalProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const { rawMarketsUnfiltered, isBlacklisted, addBlacklistedMarket, removeBlacklistedMarket, isDefaultBlacklisted } = useMarkets();

  // Reset to page 1 when search query changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Split markets into blacklisted and non-blacklisted
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
  }, [rawMarketsUnfiltered, isBlacklisted]);

  // Filter available markets based on search query
  // Only show results if user has typed at least 2 characters
  const filteredAvailableMarkets = useMemo(() => {
    const query = searchQuery.trim();

    // Require at least 2 characters to search
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

  // Pagination for available markets
  const totalPages = Math.ceil(filteredAvailableMarkets.length / ITEMS_PER_PAGE);
  const paginatedMarkets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAvailableMarkets.slice(startIndex, endIndex);
  }, [filteredAvailableMarkets, currentPage]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" size="3xl" zIndex="settings" scrollBehavior="inside">
      {(onClose) => (
        <>
          <ModalHeader
            title="Manage Blacklisted Markets"
            description="Block specific markets from appearing in your view"
            mainIcon={<MdBlockFlipped className="h-6 w-6" />}
            onClose={onClose}
          />
          <ModalBody className="flex flex-col gap-5">
            {/* Blacklisted Markets Section */}
            {blacklistedMarkets.length > 0 && (
              <>
                <div className="flex flex-col gap-3">
                  <h3 className="text-base font-normal text-primary">Blacklisted Markets ({blacklistedMarkets.length})</h3>
                </div>

                <div className="bg-surface-soft flex flex-col gap-2 rounded p-4">
                  <div className="flex flex-col gap-1.5">
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
                              iconSize={20}
                            />
                            {isDefault && (
                              <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">Default</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => removeBlacklistedMarket(market.uniqueKey)}
                            isDisabled={isDefault}
                            className="shrink-0"
                          >
                            <FiX className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Divider />
              </>
            )}

            {/* Available Markets Section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-normal text-primary">Add Markets to Blacklist</h3>
                {filteredAvailableMarkets.length > 0 && (
                  <span className="text-xs text-secondary">
                    {filteredAvailableMarkets.length} result
                    {filteredAvailableMarkets.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Search to add markets (min 2 characters)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-hovered h-10 w-full rounded p-2 font-zen text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {/* Available Markets List */}
            <div className="bg-surface-soft flex flex-col gap-2 rounded font-zen">
              {searchQuery.trim().length === 0 ? (
                <div className="text-center text-sm text-secondary py-8">Start typing to search for markets to blacklist.</div>
              ) : searchQuery.trim().length < 2 ? (
                <div className="text-center text-sm text-secondary py-8">Type at least 2 characters to search.</div>
              ) : filteredAvailableMarkets.length === 0 ? (
                <div className="text-center text-sm text-secondary py-8">No markets found matching &quot;{searchQuery}&quot;.</div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    {paginatedMarkets.map((market) => {
                      return (
                        <div
                          key={market.uniqueKey}
                          className="flex items-center justify-between gap-4 rounded bg-surface p-3 transition-colors hover:bg-surface-dark"
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
                              iconSize={20}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => addBlacklistedMarket(market.uniqueKey, market.morphoBlue.chain.id)}
                            className="shrink-0"
                          >
                            <FiPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        isDisabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-secondary">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        isDisabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onPress={onClose} size="sm">
              Close
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
