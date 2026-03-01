import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { useSmartRebalance } from '@/hooks/useSmartRebalance';
import { formatBalance, formatReadable } from '@/utils/balance';
import { calculateSmartRebalance } from '@/utils/smart-rebalance';
import type { SmartRebalanceResult } from '@/utils/smart-rebalance';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import type { GroupedPosition } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type SmartRebalanceModalProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  quickMode?: boolean;
};

function apyToApr(apy: number): number {
  if (apy <= 0) return 0;
  return Math.log(1 + apy);
}

function fmtApr(apy: number): string {
  return `${(apyToApr(apy) * 100).toFixed(2)}%`;
}

export function SmartRebalanceModal({ groupedPosition, chainId, isOpen, onOpenChange, quickMode }: SmartRebalanceModalProps) {
  // Markets with supply > 0
  const marketsWithSupply = useMemo(
    () =>
      groupedPosition.markets
        .filter((pos) => BigInt(pos.state.supplyAssets) > 0n)
        .sort(
          (a, b) =>
            Number(formatBalance(b.state.supplyAssets, b.market.loanAsset.decimals)) -
            Number(formatBalance(a.state.supplyAssets, a.market.loanAsset.decimals)),
        ),
    [groupedPosition.markets],
  );

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SmartRebalanceResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const { executeSmartRebalance, isProcessing, totalMoved, feeAmount } = useSmartRebalance(groupedPosition, result);

  const fmt = useCallback(
    (val: bigint) => formatReadable(formatBalance(val, groupedPosition.loanAssetDecimals)),
    [groupedPosition.loanAssetDecimals],
  );

  // Stable key that changes only when excluded set actually changes
  const excludedKey = useMemo(() => [...excludedIds].sort().join(','), [excludedIds]);

  // Auto-calculate on open and when excludedIds change
  const calcIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    if (excludedIds.size >= marketsWithSupply.length) {
      setResult(null);
      return;
    }

    const id = ++calcIdRef.current;
    setIsCalculating(true);

    void calculateSmartRebalance(groupedPosition, chainId, excludedIds.size > 0 ? excludedIds : undefined)
      .then((res) => {
        if (id !== calcIdRef.current) return;
        setResult(res);
      })
      .catch((err) => {
        if (id !== calcIdRef.current) return;
        console.error('[smart-rebalance] Error:', err);
        setResult(null);
      })
      .finally(() => {
        if (id !== calcIdRef.current) return;
        setIsCalculating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, excludedKey, chainId]);

  const toggleMarket = useCallback((uniqueKey: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uniqueKey)) {
        next.delete(uniqueKey);
      } else {
        next.add(uniqueKey);
      }
      return next;
    });
  }, []);

  const allExcluded = excludedIds.size >= marketsWithSupply.length;

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setExcludedIds(new Set());
      setResult(null);
    }, 200);
  }, [onOpenChange]);

  const currentApr = result ? apyToApr(result.currentWeightedApy) : 0;
  const projectedApr = result ? apyToApr(result.projectedWeightedApy) : 0;
  const aprDiff = projectedApr - currentApr;

  const buildSummaryItems = useCallback((): TransactionSummaryItem[] => {
    if (!result) return [];
    const items: TransactionSummaryItem[] = [
      {
        label: 'Weighted APR',
        value: `${fmtApr(result.currentWeightedApy)} → ${fmtApr(result.projectedWeightedApy)}`,
        detail: `(${aprDiff >= 0 ? '+' : ''}${(aprDiff * 100).toFixed(4)}%)`,
        detailColor: aprDiff >= 0 ? 'positive' : 'negative',
      },
    ];
    if (totalMoved > 0n) {
      items.push({
        label: 'Capital moved',
        value: `${fmt(totalMoved)} ${result.loanAssetSymbol}`,
      });
      items.push({
        label: 'Fee (0.01%)',
        value: `${fmt(feeAmount)} ${result.loanAssetSymbol}`,
      });
    }
    return items;
  }, [result, aprDiff, totalMoved, feeAmount, fmt]);

  // Quick mode: auto-execute as soon as calculation completes
  const quickFiredRef = useRef(false);
  useEffect(() => {
    if (!quickMode || !isOpen || isCalculating || !result || totalMoved === 0n) return;
    if (quickFiredRef.current) return;
    quickFiredRef.current = true;
    void executeSmartRebalance(buildSummaryItems()).then((ok) => {
      if (ok) handleClose();
    });
  }, [quickMode, isOpen, isCalculating, result, totalMoved, executeSmartRebalance, handleClose, buildSummaryItems]);

  // Reset quick-fired flag when modal closes
  useEffect(() => {
    if (!isOpen) quickFiredRef.current = false;
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      isDismissable={!isProcessing}
      flexibleWidth
    >
      <ModalHeader
        title={
          <div className="flex items-center gap-2">
            <span className="text-2xl">Smart Rebalance {groupedPosition.loanAsset ?? 'Unknown'}</span>
          </div>
        }
        description="Optimizes allocation across markets for maximum yield"
        mainIcon={
          <TokenIcon
            address={groupedPosition.loanAssetAddress as `0x${string}`}
            chainId={groupedPosition.chainId}
            symbol={groupedPosition.loanAssetSymbol}
            width={28}
            height={28}
          />
        }
        onClose={!isProcessing ? handleClose : undefined}
      />

      <ModalBody className="gap-4">
        {/* Market selection table (hidden in quick mode) */}
        {!quickMode && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-secondary">
                  <th className="px-3 py-2 font-medium">Include</th>
                  <th className="px-3 py-2 font-medium">Collateral</th>
                  <th className="px-3 py-2 text-right font-medium">Supply</th>
                  <th className="px-3 py-2 text-right font-medium">APR</th>
                </tr>
              </thead>
              <tbody>
                {marketsWithSupply.map((pos) => {
                  const isIncluded = !excludedIds.has(pos.market.uniqueKey);
                  const supplyAmount = BigInt(pos.state.supplyAssets);
                  const apy = pos.market.state?.supplyApy ? Number(pos.market.state.supplyApy) : 0;

                  return (
                    <tr
                      key={pos.market.uniqueKey}
                      className="cursor-pointer border-b border-border/50 transition-colors hover:bg-gray-50"
                      onClick={() => toggleMarket(pos.market.uniqueKey)}
                    >
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={isIncluded}
                          onCheckedChange={() => toggleMarket(pos.market.uniqueKey)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <TokenIcon
                            address={pos.market.collateralAsset.address as `0x${string}`}
                            chainId={groupedPosition.chainId}
                            symbol={pos.market.collateralAsset.symbol}
                            width={18}
                            height={18}
                          />
                          <span className="font-medium">{pos.market.collateralAsset.symbol}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span>
                          {fmt(supplyAmount)} {groupedPosition.loanAssetSymbol}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span>{fmtApr(apy)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Loading indicator */}
        {isCalculating && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Spinner size={16} />
            <p className="text-sm text-secondary">Calculating optimal allocation...</p>
          </div>
        )}

        {/* Summary */}
        {!isCalculating && result && (
          <div className="flex flex-col gap-2 rounded-lg bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-secondary">Weighted APR</div>
              <div className="flex items-center gap-2 text-base font-medium">
                <span>{fmtApr(result.currentWeightedApy)}</span>
                <span className="text-secondary">→</span>
                <span>{fmtApr(result.projectedWeightedApy)}</span>
                <span className={aprDiff >= 0 ? 'text-green-600' : 'text-red-500'}>
                  ({aprDiff >= 0 ? '+' : ''}
                  {(aprDiff * 100).toFixed(4)}%)
                </span>
              </div>
            </div>
            {totalMoved > 0n && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Capital moved</span>
                <span className="text-secondary">
                  {fmt(totalMoved)} {result.loanAssetSymbol}
                </span>
              </div>
            )}
            {totalMoved > 0n && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">Fee (0.01%)</span>
                <span className="text-secondary">
                  {fmt(feeAmount)} {result.loanAssetSymbol}
                </span>
              </div>
            )}
          </div>
        )}

        {/* No result after calculation */}
        {!isCalculating && !result && !allExcluded && (
          <div className="py-4 text-center text-sm text-secondary">No rebalancing needed — allocations are already optimal.</div>
        )}
      </ModalBody>

      <ModalFooter className="mx-2">
        <Button
          variant="default"
          onClick={handleClose}
          disabled={isProcessing}
          className="rounded-sm p-4 px-10 font-zen text-secondary duration-200 ease-in-out hover:scale-105"
        >
          Cancel
        </Button>
        <ExecuteTransactionButton
          targetChainId={groupedPosition.chainId}
          onClick={() => void executeSmartRebalance(buildSummaryItems()).then((ok) => { if (ok) handleClose(); })}
          isLoading={isProcessing}
          disabled={isCalculating || !result || totalMoved === 0n}
          className="rounded-sm p-4 px-10 font-zen text-white duration-200 ease-in-out hover:scale-105"
        >
          Execute Rebalance
        </ExecuteTransactionButton>
      </ModalFooter>
    </Modal>
  );
}
