import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/shared/table-pagination';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { MarketIdentity, MarketIdentityMode, MarketIdentityFocus } from '@/features/markets/components/market-identity';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable } from '@/utils/balance';
import { previewMarketState } from '@/utils/morpho';
import { convertApyToApr } from '@/utils/rateMath';
import type { MarketPosition } from '@/utils/types';

type PositionWithPendingDelta = MarketPosition & { pendingDelta: number };

type FromMarketsTableProps = {
  positions: PositionWithPendingDelta[];
  selectedMarketUniqueKey: string;
  onSelectMarket: (marketUniqueKey: string) => void;
  onSelectMax?: (marketUniqueKey: string, amount: number) => void;
};

const PER_PAGE = 5;

export function FromMarketsTable({ positions, selectedMarketUniqueKey, onSelectMarket, onSelectMax }: FromMarketsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const totalPages = Math.ceil(positions.length / PER_PAGE);
  const paginatedPositions = positions.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const getApyPreview = (position: PositionWithPendingDelta) => {
    if (position.pendingDelta === 0) return null;

    try {
      const deltaBigInt = BigInt(Math.floor(position.pendingDelta));
      return previewMarketState(position.market, deltaBigInt, undefined);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-2">
      {positions.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <p className="text-sm text-secondary">Loading positions...</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className="table-fixed rounded-sm font-zen text-sm">
              <colgroup>
                <col className="w-auto" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[220px]" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-2 text-left">Market</TableHead>
                  <TableHead className="px-4 py-2 text-right">{rateLabel}</TableHead>
                  <TableHead className="px-4 py-2 text-right">Util</TableHead>
                  <TableHead className="px-4 py-2 text-left">Supplied Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPositions.map((position) => {
                  const userConfirmedSupply = BigInt(position.state.supplyAssets);
                  const pendingDeltaBigInt = BigInt(position.pendingDelta);
                  const userNetSupply = userConfirmedSupply + pendingDeltaBigInt;

                  const rawMarketLiquidity = BigInt(position.market.state.liquidityAssets);
                  const adjustedMarketLiquidity = rawMarketLiquidity + pendingDeltaBigInt;

                  const maxTransferableAmount = userNetSupply < adjustedMarketLiquidity ? userNetSupply : adjustedMarketLiquidity;

                  const isSelected = position.market.uniqueKey === selectedMarketUniqueKey;
                  const apyPreview = getApyPreview(position);
                  return (
                    <TableRow
                      key={position.market.uniqueKey}
                      onClick={() => onSelectMarket(position.market.uniqueKey)}
                      className={`cursor-pointer border-b border-l-2 border-l-transparent border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${
                        isSelected ? 'bg-primary/5 border-l-primary' : ''
                      }`}
                    >
                      <TableCell className="px-4 py-2">
                        <div className="flex items-center justify-start">
                          <MarketIdentity
                            market={position.market}
                            chainId={position.market.morphoBlue.chain.id}
                            mode={MarketIdentityMode.Focused}
                            focus={MarketIdentityFocus.Collateral}
                            showLltv
                            showOracle
                            showId
                            iconSize={18}
                            showExplorerLink={false}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right">
                        {apyPreview ? (
                          <span className="whitespace-nowrap text-sm text-foreground">
                            <span className="line-through opacity-50">
                              {formatReadable(
                                (isAprDisplay ? convertApyToApr(position.market.state.supplyApy) : position.market.state.supplyApy) * 100,
                              )}
                              %
                            </span>
                            {' → '}
                            <span>
                              {formatReadable((isAprDisplay ? convertApyToApr(apyPreview.supplyApy) : apyPreview.supplyApy) * 100)}%
                            </span>
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-sm text-foreground">
                            {formatReadable(
                              (isAprDisplay ? convertApyToApr(position.market.state.supplyApy) : position.market.state.supplyApy) * 100,
                            )}
                            %
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right">
                        {apyPreview ? (
                          <span className="whitespace-nowrap text-sm text-foreground">
                            <span className="line-through opacity-50">{formatReadable(position.market.state.utilization * 100)}%</span>
                            {' → '}
                            <span>{formatReadable(apyPreview.utilization * 100)}%</span>
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-sm text-foreground">
                            {formatReadable(position.market.state.utilization * 100)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <div>
                            {formatReadable(
                              (Number(position.state.supplyAssets) + Number(position.pendingDelta)) /
                                10 ** position.market.loanAsset.decimals,
                            )}{' '}
                            {position.market.loanAsset.symbol}
                          </div>
                          <Button
                            size="sm"
                            variant="surface"
                            className="h-5 min-w-0 px-2 text-xs"
                            disabled={maxTransferableAmount <= 0n}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              onSelectMarket(position.market.uniqueKey);
                              if (onSelectMax && maxTransferableAmount > 0n) {
                                onSelectMax(position.market.uniqueKey, Number(maxTransferableAmount));
                              }
                            }}
                          >
                            Max
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalEntries={positions.length}
              pageSize={PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}
    </div>
  );
}
