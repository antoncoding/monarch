import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
import { HelpTooltipIcon } from '@/components/shared/help-tooltip-icon';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent as SharedTooltipContent } from '@/components/shared/tooltip-content';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { useModalStore } from '@/stores/useModalStore';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useRebalance } from '@/hooks/useRebalance';
import { useSmartRebalance } from '@/hooks/useSmartRebalance';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useAppSettings, type RebalanceDefaultMode } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import type { Market } from '@/utils/types';
import type { GroupedPosition, RebalanceAction } from '@/utils/types';
import { formatBalance, formatReadable } from '@/utils/balance';
import { formatUsdValue } from '@/utils/portfolio';
import { formatUsdValueDisplay } from '@/utils/assetDisplay';
import { convertApyToApr } from '@/utils/rateMath';
import { calculateSmartRebalancePlan, type SmartRebalancePlan } from '@/features/positions/smart-rebalance/planner';
import type { SmartRebalanceConstraintMap } from '@/features/positions/smart-rebalance/types';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import type { SupportedNetworks } from '@/utils/networks';
import { formatTokenAmountPreview } from '@/hooks/leverage/math';
import { REBALANCE_FEE_CEILING_USD } from '@/config/fees';
import { RiSparklingFill } from 'react-icons/ri';
import { FiTrash2 } from 'react-icons/fi';
import { AllocationCell } from '../allocation-cell';
import { FromMarketsTable } from '../from-markets-table';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { RebalanceActionInput } from './rebalance-action-input';
import { RebalanceCart } from './rebalance-cart';

type RebalanceModalProps = {
  groupedPosition: GroupedPosition;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
};

type RebalanceMode = RebalanceDefaultMode;

const modeOptions: { value: RebalanceMode; label: string }[] = [
  { value: 'smart', label: 'Smart Rebalance' },
  { value: 'manual', label: 'Manual Rebalance' },
];
const SMART_REBALANCE_RECALC_DEBOUNCE_MS = 300;
const MAX_ALLOCATION_PERCENT_MIN = 0;
const MAX_ALLOCATION_PERCENT_MAX = 100;
const MAX_ALLOCATION_PERCENT_STEP = 0.5;
const SMART_REBALANCE_FEE_LABEL = 'Fee';
const INLINE_VALUE_TOOLTIP_CLASS_NAME = 'px-4 py-3 text-xs';

function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

function formatRate(apy: number, isAprDisplay: boolean): string {
  if (!Number.isFinite(apy)) return '-';
  const displayRate = isAprDisplay ? convertApyToApr(apy) : apy;
  if (!Number.isFinite(displayRate)) return '-';
  return formatPercent(displayRate * 100, 2);
}

function formatDailyEarning(value: number): string {
  const formattedValue = formatUsdValue(value, value < 1 ? 4 : 2);
  return `${formattedValue}/day`;
}

function formatMaxAllocationInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseMaxAllocationInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '.' || trimmed === ',') return null;
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return null;

  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function getSmartPlannerMarketSignature(market: Market): string {
  return [
    market.uniqueKey,
    market.loanAsset.address.toLowerCase(),
    market.collateralAsset.address.toLowerCase(),
    market.oracleAddress?.toLowerCase() ?? '',
    market.irmAddress?.toLowerCase() ?? '',
    market.lltv ?? '',
    market.state.rateAtTarget,
  ].join(':');
}

function getSmartPlannerConstraintSignature(constraints: Record<string, number>): string {
  return Object.entries(constraints)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');
}

function getSmartPlannerGroupedPositionSignature(groupedPosition: GroupedPosition): string {
  return groupedPosition.markets
    .map((position) => `${position.market.uniqueKey}:${position.state.supplyAssets}:${position.state.supplyShares}`)
    .sort()
    .join('|');
}

type PreviewRow = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
};

function PreviewSection({ title, rows }: { title: string; rows: PreviewRow[] }) {
  return (
    <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
      <p className="mb-2 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">{title}</p>
      <div className="space-y-1 text-xs">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-secondary">{row.label}</span>
            <span className={row.valueClassName ?? 'tabular-nums'}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RebalanceModal({ groupedPosition, isOpen, onOpenChange, refetch, isRefetching }: RebalanceModalProps) {
  const [mode, setMode] = useState<RebalanceMode>('smart');

  const [selectedFromMarketUniqueKey, setSelectedFromMarketUniqueKey] = useState('');
  const [selectedToMarketUniqueKey, setSelectedToMarketUniqueKey] = useState('');
  const [amount, setAmount] = useState<string>('0');

  const [smartSelectedMarketKeys, setSmartSelectedMarketKeys] = useState<Set<string>>(new Set());
  const [smartMaxAllocationBps, setSmartMaxAllocationBps] = useState<Record<string, number>>({});
  const [smartMaxAllocationInputValues, setSmartMaxAllocationInputValues] = useState<Record<string, string>>({});
  const [debouncedSmartMaxAllocationBps, setDebouncedSmartMaxAllocationBps] = useState<Record<string, number>>({});
  const [smartPlan, setSmartPlan] = useState<SmartRebalancePlan | null>(null);
  const [isSmartCalculating, setIsSmartCalculating] = useState(false);
  const [smartCalculationError, setSmartCalculationError] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isRefreshSynced, setIsRefreshSynced] = useState(false);

  const calcIdRef = useRef(0);
  const wasOpenRef = useRef(false);
  const syncIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smartPlannerEligibleMarketsRef = useRef<Market[]>([]);

  const toast = useStyledToast();
  const { isAprDisplay, rebalanceDefaultMode } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const { open: openModal, close: closeModal } = useModalStore();

  const { markets } = useProcessedMarkets();
  const {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isProcessing: isManualProcessing,
  } = useRebalance(groupedPosition);

  const handleSmartTxSuccess = useCallback(() => {
    refetch(() => {
      toast.info('Data refreshed', 'Position data updated after smart rebalance.');
    });
  }, [refetch, toast]);

  const {
    executeSmartRebalance,
    isProcessing: isSmartProcessing,
    totalMoved: smartTotalMoved,
    feeAmount: smartFeeAmount,
    feeUsdValue: smartFeeUsdValue,
    isFeeCapped: smartFeeIsCapped,
    isFeeReady: isSmartFeeReady,
    estimatedDailyEarningsUsd,
  } = useSmartRebalance(groupedPosition, smartPlan, handleSmartTxSuccess);

  const eligibleMarkets = useMemo(() => {
    return markets.filter(
      (market) => market.loanAsset.address === groupedPosition.loanAssetAddress && market.morphoBlue.chain.id === groupedPosition.chainId,
    );
  }, [markets, groupedPosition.loanAssetAddress, groupedPosition.chainId]);

  const smartPlannerEligibleMarketsSignature = useMemo(
    () => eligibleMarkets.map(getSmartPlannerMarketSignature).sort().join('|'),
    [eligibleMarkets],
  );
  const smartPlannerSelectedMarketsSignature = useMemo(() => [...smartSelectedMarketKeys].sort().join('|'), [smartSelectedMarketKeys]);
  const smartPlannerConstraintSignature = useMemo(
    () => getSmartPlannerConstraintSignature(debouncedSmartMaxAllocationBps),
    [debouncedSmartMaxAllocationBps],
  );
  const smartPlannerGroupedPositionSignature = useMemo(() => getSmartPlannerGroupedPositionSignature(groupedPosition), [groupedPosition]);

  useEffect(() => {
    smartPlannerEligibleMarketsRef.current = eligibleMarkets;
  }, [eligibleMarkets, smartPlannerEligibleMarketsSignature]);

  const currentSupplyByMarket = useMemo(
    () => new Map(groupedPosition.markets.map((position) => [position.market.uniqueKey, BigInt(position.state.supplyAssets)])),
    [groupedPosition.markets],
  );

  const marketByKey = useMemo(() => new Map(eligibleMarkets.map((market) => [market.uniqueKey, market])), [eligibleMarkets]);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!isOpen || wasOpen) return;
    const nextDefaultSmartMarketKeys = groupedPosition.markets
      .filter((position) => BigInt(position.state.supplyAssets) > 0n)
      .map((position) => position.market.uniqueKey);

    setMode(rebalanceDefaultMode);
    setSmartSelectedMarketKeys(new Set(nextDefaultSmartMarketKeys));
    setSmartMaxAllocationBps({});
    setSmartMaxAllocationInputValues({});
    setDebouncedSmartMaxAllocationBps({});
    setSmartPlan(null);
    setSmartCalculationError(null);
  }, [groupedPosition.markets, isOpen, rebalanceDefaultMode]);

  useEffect(() => {
    return () => {
      if (syncIndicatorTimeoutRef.current) {
        clearTimeout(syncIndicatorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || mode !== 'smart') return;

    const timeoutId = setTimeout(() => {
      setDebouncedSmartMaxAllocationBps(smartMaxAllocationBps);
    }, SMART_REBALANCE_RECALC_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isOpen, mode, smartMaxAllocationBps]);

  useEffect(() => {
    if (!isOpen || mode !== 'smart') return;

    if (smartSelectedMarketKeys.size === 0) {
      setSmartPlan(null);
      setSmartCalculationError(null);
      return;
    }

    const id = ++calcIdRef.current;
    setIsSmartCalculating(true);
    setSmartCalculationError(null);

    const constraints: SmartRebalanceConstraintMap = {};
    for (const key of smartSelectedMarketKeys) {
      const maxAllocationBps = debouncedSmartMaxAllocationBps[key];
      if (maxAllocationBps !== undefined) {
        constraints[key] = { maxAllocationBps };
      }
    }

    console.debug('[smart-rebalance] plan calculation start', {
      calcId: id,
      chainId: groupedPosition.chainId,
      selectedMarketKeys: [...smartSelectedMarketKeys].sort(),
      candidateMarketCount: smartPlannerEligibleMarketsRef.current.length,
      constraintCount: Object.keys(constraints).length,
    });

    void calculateSmartRebalancePlan({
      groupedPosition,
      chainId: groupedPosition.chainId as SupportedNetworks,
      candidateMarkets: smartPlannerEligibleMarketsRef.current,
      includedMarketKeys: smartSelectedMarketKeys,
      constraints,
    })
      .then((plan) => {
        if (id !== calcIdRef.current) {
          console.debug('[smart-rebalance] plan calculation ignored stale success', {
            calcId: id,
            latestCalcId: calcIdRef.current,
          });
          return;
        }
        console.debug('[smart-rebalance] plan calculation success', {
          calcId: id,
          hasPlan: plan !== null,
          totalMoved: plan?.totalMoved.toString() ?? '0',
          deltaCount: plan?.deltas.length ?? 0,
        });
        setSmartPlan(plan);
      })
      .catch((error: unknown) => {
        if (id !== calcIdRef.current) {
          console.debug('[smart-rebalance] plan calculation ignored stale error', {
            calcId: id,
            latestCalcId: calcIdRef.current,
          });
          return;
        }
        setSmartPlan(null);
        const message = error instanceof Error ? error.message : 'Failed to calculate smart rebalance plan.';
        console.error('[smart-rebalance] plan calculation failed', {
          calcId: id,
          chainId: groupedPosition.chainId,
          message,
          error,
        });
        setSmartCalculationError(message);
      })
      .finally(() => {
        if (id !== calcIdRef.current) {
          console.debug('[smart-rebalance] plan calculation skipped stale finalize', {
            calcId: id,
            latestCalcId: calcIdRef.current,
          });
          return;
        }
        console.debug('[smart-rebalance] plan calculation finalize', {
          calcId: id,
        });
        setIsSmartCalculating(false);
      });
  }, [
    debouncedSmartMaxAllocationBps,
    groupedPosition,
    isOpen,
    mode,
    smartPlannerConstraintSignature,
    smartPlannerEligibleMarketsSignature,
    smartPlannerGroupedPositionSignature,
    smartPlannerSelectedMarketsSignature,
    smartSelectedMarketKeys,
  ]);

  const fmtAmount = useCallback(
    (value: bigint) => `${formatReadable(formatBalance(value, groupedPosition.loanAssetDecimals))} ${groupedPosition.loanAssetSymbol}`,
    [groupedPosition.loanAssetDecimals, groupedPosition.loanAssetSymbol],
  );

  const smartCurrentWeightedApr = useMemo(() => (smartPlan ? convertApyToApr(smartPlan.currentWeightedApy) : 0), [smartPlan]);

  const smartProjectedWeightedApr = useMemo(() => (smartPlan ? convertApyToApr(smartPlan.projectedWeightedApy) : 0), [smartPlan]);

  const smartCurrentWeightedApy = smartPlan?.currentWeightedApy ?? 0;
  const smartProjectedWeightedApy = smartPlan?.projectedWeightedApy ?? 0;
  const smartCurrentWeightedRate = isAprDisplay ? smartCurrentWeightedApr : smartCurrentWeightedApy;
  const smartProjectedWeightedRate = isAprDisplay ? smartProjectedWeightedApr : smartProjectedWeightedApy;
  const smartWeightedRateDiff = smartProjectedWeightedRate - smartCurrentWeightedRate;
  const smartCapitalMovedPreview = useMemo(
    () => formatTokenAmountPreview(smartTotalMoved, groupedPosition.loanAssetDecimals),
    [groupedPosition.loanAssetDecimals, smartTotalMoved],
  );
  const smartFeePreview = useMemo(
    () => (smartFeeAmount == null ? null : formatTokenAmountPreview(smartFeeAmount, groupedPosition.loanAssetDecimals)),
    [groupedPosition.loanAssetDecimals, smartFeeAmount],
  );
  const smartFeeUsdDisplay = useMemo(() => (smartFeeUsdValue == null ? null : formatUsdValueDisplay(smartFeeUsdValue)), [smartFeeUsdValue]);
  const smartFeeSummaryDetail = useMemo(() => {
    return [smartFeeUsdDisplay?.display, smartFeeIsCapped ? 'capped' : null].filter((part): part is string => part != null).join(' · ');
  }, [smartFeeIsCapped, smartFeeUsdDisplay]);

  const smartSummaryItems = useMemo((): TransactionSummaryItem[] => {
    if (!smartPlan) return [];

    const items: TransactionSummaryItem[] = [
      {
        id: 'weighted-rate',
        label: `Weighted ${rateLabel}`,
        value: `${formatPercent(smartCurrentWeightedRate * 100)} → ${formatPercent(smartProjectedWeightedRate * 100)}`,
        detail: `(${smartWeightedRateDiff >= 0 ? '+' : ''}${formatPercent(smartWeightedRateDiff * 100)})`,
        detailColor: smartWeightedRateDiff >= 0 ? 'positive' : 'negative',
      },
    ];

    if (estimatedDailyEarningsUsd !== null) {
      items.push({
        id: 'estimated-daily-earning',
        label: 'Estimated Daily Earning',
        value: formatDailyEarning(estimatedDailyEarningsUsd),
      });
    }

    if (smartTotalMoved > 0n) {
      items.push({
        id: 'capital-moved',
        label: 'Capital Moved',
        value: fmtAmount(smartTotalMoved),
      });
      if (smartFeePreview != null) {
        items.push({
          id: 'fee',
          label: SMART_REBALANCE_FEE_LABEL,
          value: `${smartFeePreview.compact} ${groupedPosition.loanAssetSymbol}`,
          detail: smartFeeSummaryDetail || undefined,
        });
      }
    }

    return items;
  }, [
    fmtAmount,
    groupedPosition.loanAssetSymbol,
    rateLabel,
    smartCurrentWeightedRate,
    estimatedDailyEarningsUsd,
    smartFeePreview,
    smartFeeSummaryDetail,
    smartPlan,
    smartProjectedWeightedRate,
    smartTotalMoved,
    smartWeightedRateDiff,
  ]);

  const smartFeePreviewRow = useMemo<PreviewRow | null>(() => {
    if (smartFeePreview == null) return null;

    return {
      id: 'fee',
      label: (
        <span className="flex items-center gap-0.5 text-secondary">
          Fee
          <HelpTooltipIcon
            content={
              <SharedTooltipContent
                title="Fee policy"
                detail="0.3 bps (0.003%) of capital moved."
                secondaryDetail={`Capped at $${REBALANCE_FEE_CEILING_USD} per transaction.`}
              />
            }
            ariaLabel="Explain smart rebalance fee policy"
            className="h-auto w-auto"
          />
        </span>
      ),
      value: (
        <span className="tabular-nums inline-flex items-center gap-1.5">
          <Tooltip
            content={`${smartFeePreview.full} ${groupedPosition.loanAssetSymbol}`}
            className={INLINE_VALUE_TOOLTIP_CLASS_NAME}
          >
            <span className="cursor-help border-b border-dotted border-white/40">{smartFeePreview.compact}</span>
          </Tooltip>
          {smartFeeUsdDisplay != null &&
            (smartFeeUsdDisplay.showExactTooltip ? (
              <Tooltip
                content={`Exact fee: ${smartFeeUsdDisplay.exact}`}
                className={INLINE_VALUE_TOOLTIP_CLASS_NAME}
              >
                <span className="cursor-help border-b border-dotted border-white/40 text-secondary">{smartFeeUsdDisplay.display}</span>
              </Tooltip>
            ) : (
              <span className="text-secondary">{smartFeeUsdDisplay.display}</span>
            ))}
          {smartFeeIsCapped && <span className="text-secondary">capped</span>}
          <TokenIcon
            address={groupedPosition.loanAssetAddress as `0x${string}`}
            chainId={groupedPosition.chainId}
            symbol={groupedPosition.loanAssetSymbol}
            width={14}
            height={14}
          />
        </span>
      ),
    };
  }, [
    groupedPosition.chainId,
    groupedPosition.loanAssetAddress,
    groupedPosition.loanAssetSymbol,
    smartFeeIsCapped,
    smartFeePreview,
    smartFeeUsdDisplay,
  ]);

  const smartRows = useMemo(() => {
    const selectedMarkets = [...smartSelectedMarketKeys]
      .map((key) => marketByKey.get(key))
      .filter((market): market is Market => market !== undefined)
      .sort((a, b) => {
        const aCurrent = currentSupplyByMarket.get(a.uniqueKey) ?? 0n;
        const bCurrent = currentSupplyByMarket.get(b.uniqueKey) ?? 0n;
        if (bCurrent > aCurrent) return 1;
        if (bCurrent < aCurrent) return -1;
        return a.collateralAsset.symbol.localeCompare(b.collateralAsset.symbol);
      });

    const totalPool =
      smartPlan?.totalPool ?? selectedMarkets.reduce((sum, market) => sum + (currentSupplyByMarket.get(market.uniqueKey) ?? 0n), 0n);
    const deltaByMarket = new Map(smartPlan?.deltas.map((delta) => [delta.market.uniqueKey, delta]));

    return selectedMarkets.map((market) => {
      const currentAmount = currentSupplyByMarket.get(market.uniqueKey) ?? 0n;
      const delta = deltaByMarket.get(market.uniqueKey);
      const targetAmount = delta?.targetAmount ?? currentAmount;
      const amountDelta = targetAmount - currentAmount;
      const projectedApy = delta?.projectedApy ?? delta?.currentApy ?? market.state.supplyApy;
      const currentAmountDisplay = formatBalance(currentAmount, groupedPosition.loanAssetDecimals);
      const targetAmountDisplay = formatBalance(targetAmount, groupedPosition.loanAssetDecimals);

      const currentShare = totalPool > 0n ? Number((currentAmount * 10_000n) / totalPool) / 100 : 0;
      const targetShare = totalPool > 0n ? Number((targetAmount * 10_000n) / totalPool) / 100 : 0;

      return {
        market,
        currentAmount,
        targetAmount,
        amountDelta,
        currentShare,
        targetShare,
        projectedApy,
        currentAmountDisplay,
        targetAmountDisplay,
      };
    });
  }, [currentSupplyByMarket, groupedPosition.loanAssetDecimals, marketByKey, smartPlan, smartSelectedMarketKeys]);

  const constraintViolations = useMemo(() => {
    if (!smartPlan) return [];

    const deltaByMarket = new Map(smartPlan.deltas.map((delta) => [delta.market.uniqueKey, delta]));
    const violations: { uniqueKey: string; maxAllocationBps: number }[] = [];

    for (const [uniqueKey, maxAllocationBps] of Object.entries(debouncedSmartMaxAllocationBps)) {
      if (maxAllocationBps >= 10_000) continue;

      const delta = deltaByMarket.get(uniqueKey);
      const targetAmount = delta?.targetAmount ?? currentSupplyByMarket.get(uniqueKey) ?? 0n;
      const maxAllowedAmount = (smartPlan.totalPool * BigInt(maxAllocationBps)) / 10_000n;

      if (targetAmount > maxAllowedAmount) {
        violations.push({ uniqueKey, maxAllocationBps });
      }
    }

    return violations;
  }, [currentSupplyByMarket, debouncedSmartMaxAllocationBps, smartPlan]);

  const isSmartWithdrawOnly = useMemo(() => {
    if (!smartPlan || smartTotalMoved === 0n) return false;
    return smartPlan.deltas.every((delta) => delta.delta <= 0n);
  }, [smartPlan, smartTotalMoved]);

  const isSmartConstraintsPending = useMemo(() => {
    const sourceEntries = Object.entries(smartMaxAllocationBps).sort(([left], [right]) => left.localeCompare(right));
    const debouncedEntries = Object.entries(debouncedSmartMaxAllocationBps).sort(([left], [right]) => left.localeCompare(right));

    return JSON.stringify(sourceEntries) !== JSON.stringify(debouncedEntries);
  }, [debouncedSmartMaxAllocationBps, smartMaxAllocationBps]);

  const smartCanExecute = !isSmartCalculating && !isSmartConstraintsPending && !!smartPlan && smartTotalMoved > 0n && isSmartFeeReady;

  const handleDeleteSmartMarket = useCallback(
    (uniqueKey: string) => {
      const currentAmount = currentSupplyByMarket.get(uniqueKey) ?? 0n;

      if (currentAmount > 0n) {
        setSmartMaxAllocationBps((prev) => ({
          ...prev,
          [uniqueKey]: 0,
        }));
        setSmartMaxAllocationInputValues((prev) => ({
          ...prev,
          [uniqueKey]: formatMaxAllocationInput(0),
        }));
        return;
      }

      setSmartSelectedMarketKeys((prev) => {
        const next = new Set(prev);
        next.delete(uniqueKey);
        return next;
      });

      setSmartMaxAllocationBps((prev) => {
        if (!(uniqueKey in prev)) return prev;
        const rest = { ...prev };
        delete rest[uniqueKey];
        return rest;
      });

      setSmartMaxAllocationInputValues((prev) => {
        if (!(uniqueKey in prev)) return prev;
        const rest = { ...prev };
        delete rest[uniqueKey];
        return rest;
      });
    },
    [currentSupplyByMarket],
  );

  const updateMaxAllocation = useCallback((uniqueKey: string, value: number) => {
    const clamped = Math.max(MAX_ALLOCATION_PERCENT_MIN, Math.min(MAX_ALLOCATION_PERCENT_MAX, value));
    const snapped = Math.round(clamped / MAX_ALLOCATION_PERCENT_STEP) * MAX_ALLOCATION_PERCENT_STEP;
    const nextBps = Math.round(snapped * 100);

    setSmartMaxAllocationBps((prev) => ({
      ...prev,
      [uniqueKey]: nextBps,
    }));

    setSmartMaxAllocationInputValues((prev) => ({
      ...prev,
      [uniqueKey]: formatMaxAllocationInput(snapped),
    }));
  }, []);

  const handleMaxAllocationInputChange = useCallback((uniqueKey: string, value: string) => {
    setSmartMaxAllocationInputValues((prev) => ({
      ...prev,
      [uniqueKey]: value,
    }));
  }, []);

  const handleMaxAllocationInputBlur = useCallback(
    (uniqueKey: string) => {
      const fallbackValue = (smartMaxAllocationBps[uniqueKey] ?? 10_000) / 100;
      const rawInput = smartMaxAllocationInputValues[uniqueKey] ?? formatMaxAllocationInput(fallbackValue);
      const parsed = parseMaxAllocationInput(rawInput);

      if (parsed === null) {
        setSmartMaxAllocationInputValues((prev) => ({
          ...prev,
          [uniqueKey]: formatMaxAllocationInput(fallbackValue),
        }));
        return;
      }

      const bounded = Math.max(MAX_ALLOCATION_PERCENT_MIN, Math.min(MAX_ALLOCATION_PERCENT_MAX, parsed));
      const normalized = Math.round(bounded / MAX_ALLOCATION_PERCENT_STEP) * MAX_ALLOCATION_PERCENT_STEP;
      updateMaxAllocation(uniqueKey, normalized);
    },
    [smartMaxAllocationBps, smartMaxAllocationInputValues, updateMaxAllocation],
  );

  const handleAddSmartMarkets = useCallback(() => {
    openModal('rebalanceMarketSelection', {
      vaultAsset: groupedPosition.loanAssetAddress as `0x${string}`,
      chainId: groupedPosition.chainId as SupportedNetworks,
      multiSelect: true,
      onSelect: (selectedMarkets) => {
        setSmartSelectedMarketKeys((prev) => {
          const next = new Set(prev);
          for (const market of selectedMarkets) {
            next.add(market.uniqueKey);
          }
          return next;
        });
        closeModal('rebalanceMarketSelection');
      },
    });
  }, [closeModal, groupedPosition.chainId, groupedPosition.loanAssetAddress, openModal]);

  const getPendingDelta = useCallback(
    (marketUniqueKey: string): bigint => {
      return rebalanceActions.reduce((acc: bigint, action: RebalanceAction) => {
        if (action.fromMarket.uniqueKey === marketUniqueKey) {
          return acc - BigInt(action.amount);
        }
        if (action.toMarket.uniqueKey === marketUniqueKey) {
          return acc + BigInt(action.amount);
        }
        return acc;
      }, 0n);
    },
    [rebalanceActions],
  );

  const validateInputs = useCallback(() => {
    if (!selectedFromMarketUniqueKey || !selectedToMarketUniqueKey || !amount) {
      const missingFields = [];
      if (!selectedFromMarketUniqueKey) missingFields.push('"From Market"');
      if (!selectedToMarketUniqueKey) missingFields.push('"To Market"');
      if (!amount) missingFields.push('"Amount"');
      toast.error('Missing fields', `Missing fields: ${missingFields.join(', ')}`);
      return false;
    }

    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    if (scaledAmount <= 0n) {
      toast.error('Invalid amount', 'Amount must be greater than zero');
      return false;
    }

    return true;
  }, [amount, groupedPosition.loanAssetDecimals, selectedFromMarketUniqueKey, selectedToMarketUniqueKey, toast]);

  const getMarkets = useCallback(() => {
    const fromMarket = eligibleMarkets.find((market) => market.uniqueKey === selectedFromMarketUniqueKey);
    const toMarket = eligibleMarkets.find((market) => market.uniqueKey === selectedToMarketUniqueKey);

    if (!fromMarket || !toMarket) {
      const missing = `${fromMarket ? '' : '"From"'}${toMarket ? '' : `${fromMarket ? '' : ' and '}"To"`}`;
      toast.error('Invalid market selection', `Invalid ${missing} market`);
      return null;
    }

    return { fromMarket, toMarket };
  }, [eligibleMarkets, selectedFromMarketUniqueKey, selectedToMarketUniqueKey, toast]);

  const checkBalance = useCallback(() => {
    const oldBalance = groupedPosition.markets.find((position) => position.market.uniqueKey === selectedFromMarketUniqueKey)?.state
      .supplyAssets;
    const pendingDelta = getPendingDelta(selectedFromMarketUniqueKey);
    const pendingBalance = BigInt(oldBalance ?? 0) + pendingDelta;

    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    if (scaledAmount > pendingBalance) {
      toast.error('Insufficient balance', "You don't have enough balance to perform this action");
      return false;
    }
    return true;
  }, [amount, getPendingDelta, groupedPosition.loanAssetDecimals, groupedPosition.markets, selectedFromMarketUniqueKey, toast]);

  const createAction = useCallback((fromMarket: Market, toMarket: Market, actionAmount: bigint, isMax: boolean): RebalanceAction => {
    return {
      fromMarket: {
        loanToken: fromMarket.loanAsset.address,
        collateralToken: fromMarket.collateralAsset.address,
        oracle: fromMarket.oracleAddress,
        irm: fromMarket.irmAddress,
        lltv: fromMarket.lltv,
        uniqueKey: fromMarket.uniqueKey,
      },
      toMarket: {
        loanToken: toMarket.loanAsset.address,
        collateralToken: toMarket.collateralAsset.address,
        oracle: toMarket.oracleAddress,
        irm: toMarket.irmAddress,
        lltv: toMarket.lltv,
        uniqueKey: toMarket.uniqueKey,
      },
      amount: actionAmount,
      isMax,
    };
  }, []);

  const resetSelections = useCallback(() => {
    setSelectedFromMarketUniqueKey('');
    setSelectedToMarketUniqueKey('');
    setAmount('0');
  }, []);

  const handleMaxSelect = useCallback(
    (marketUniqueKey: string, maxAmount: bigint) => {
      const market = eligibleMarkets.find((target) => target.uniqueKey === marketUniqueKey);
      if (!market) return;
      setSelectedFromMarketUniqueKey(marketUniqueKey);
      setAmount(formatUnits(maxAmount, groupedPosition.loanAssetDecimals));
    },
    [eligibleMarkets, groupedPosition.loanAssetDecimals],
  );

  const handleAddAction = useCallback(() => {
    if (!validateInputs()) return;

    const fromToMarkets = getMarkets();
    if (!fromToMarkets) return;

    if (!checkBalance()) return;

    const { fromMarket, toMarket } = fromToMarkets;
    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    const selectedPosition = groupedPosition.markets.find((position) => position.market.uniqueKey === selectedFromMarketUniqueKey);
    const pendingDelta = selectedPosition ? getPendingDelta(selectedPosition.market.uniqueKey) : 0n;

    const isMaxAmount = selectedPosition !== undefined && BigInt(selectedPosition.state.supplyAssets) + pendingDelta === scaledAmount;

    addRebalanceAction(createAction(fromMarket, toMarket, scaledAmount, isMaxAmount));
    resetSelections();
  }, [
    addRebalanceAction,
    amount,
    checkBalance,
    createAction,
    getMarkets,
    getPendingDelta,
    groupedPosition.loanAssetDecimals,
    groupedPosition.markets,
    resetSelections,
    selectedFromMarketUniqueKey,
    validateInputs,
  ]);

  const handleExecuteManualRebalance = useCallback(() => {
    void (async () => {
      const ok = await executeRebalance();
      if (ok) {
        refetch(() => {
          toast.info('Data refreshed', 'Position data updated after rebalance.');
        });
      }
    })();
  }, [executeRebalance, refetch, toast]);

  const handleExecuteSmartRebalance = useCallback(() => {
    if (!smartCanExecute) return;
    void executeSmartRebalance(smartSummaryItems);
  }, [executeSmartRebalance, smartCanExecute, smartSummaryItems]);

  const refreshActionLoading = isManualRefreshing || isRefetching;

  const handleManualRefresh = useCallback(() => {
    if (refreshActionLoading) return;

    setIsRefreshSynced(false);
    setIsManualRefreshing(true);

    void Promise.resolve(
      refetch(() => {
        if (syncIndicatorTimeoutRef.current) {
          clearTimeout(syncIndicatorTimeoutRef.current);
        }

        setIsRefreshSynced(true);
        syncIndicatorTimeoutRef.current = setTimeout(() => {
          setIsRefreshSynced(false);
        }, 1500);

        toast.info('Synced', 'Position data updated', {
          icon: <span>✓</span>,
        });
      }),
    ).finally(() => {
      setIsManualRefreshing(false);
    });
  }, [refetch, refreshActionLoading, toast]);

  const smartPreviewRows = useMemo<PreviewRow[]>(() => {
    const rows: PreviewRow[] = [
      {
        id: 'weighted-rate',
        label: `Weighted ${rateLabel}`,
        value: (
          <>
            {formatPercent(smartCurrentWeightedRate * 100)} → {formatPercent(smartProjectedWeightedRate * 100)}{' '}
            <span className={smartWeightedRateDiff >= 0 ? 'text-green-600' : 'text-red-500'}>
              ({smartWeightedRateDiff >= 0 ? '+' : ''}
              {formatPercent(smartWeightedRateDiff * 100)})
            </span>
          </>
        ),
      },
    ];

    if (estimatedDailyEarningsUsd !== null) {
      rows.push({
        id: 'estimated-daily-earning',
        label: 'Estimated Daily Earning',
        value: formatDailyEarning(estimatedDailyEarningsUsd),
        valueClassName: 'tabular-nums text-green-600',
      });
    }

    rows.push({
      id: 'capital-moved',
      label: 'Capital Moved',
      value: (
        <span className="tabular-nums inline-flex items-center gap-1.5">
          <Tooltip
            content={`${smartCapitalMovedPreview.full} ${groupedPosition.loanAssetSymbol}`}
            className={INLINE_VALUE_TOOLTIP_CLASS_NAME}
          >
            <span className="cursor-help border-b border-dotted border-white/40">{smartCapitalMovedPreview.compact}</span>
          </Tooltip>
          <TokenIcon
            address={groupedPosition.loanAssetAddress as `0x${string}`}
            chainId={groupedPosition.chainId}
            symbol={groupedPosition.loanAssetSymbol}
            width={14}
            height={14}
          />
        </span>
      ),
    });

    return rows;
  }, [
    estimatedDailyEarningsUsd,
    groupedPosition.chainId,
    groupedPosition.loanAssetAddress,
    groupedPosition.loanAssetSymbol,
    rateLabel,
    smartCapitalMovedPreview,
    smartCurrentWeightedRate,
    smartProjectedWeightedRate,
    smartTotalMoved,
    smartWeightedRateDiff,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={false}
      flexibleWidth
      className="w-[95vw] max-w-[1080px]"
    >
      <ModalHeader
        title={
          <div className="flex items-center gap-2">
            <ModalIntentSwitcher
              value={mode}
              options={modeOptions}
              onValueChange={(nextMode) => setMode(nextMode as RebalanceMode)}
              className="text-2xl"
            />
            {mode === 'smart' && (
              <Badge
                variant="default"
                className="inline-flex items-center gap-1"
              >
                <RiSparklingFill className="h-3 w-3 text-yellow-400" />
                New
              </Badge>
            )}
          </div>
        }
        description={
          mode === 'manual'
            ? `Move ${groupedPosition.loanAssetSymbol} between markets with explicit actions.`
            : `Auto-compute an optimal ${groupedPosition.loanAssetSymbol} allocation for better yield.`
        }
        mainIcon={
          <TokenIcon
            address={groupedPosition.loanAssetAddress as `0x${string}`}
            chainId={groupedPosition.chainId}
            symbol={groupedPosition.loanAssetSymbol}
            width={28}
            height={28}
          />
        }
        onClose={() => onOpenChange(false)}
        auxiliaryAction={{
          icon: isRefreshSynced ? <CheckIcon className="h-3 w-3 text-green-500" /> : <RefetchIcon isLoading={refreshActionLoading} />,
          onClick: () => {
            if (!refreshActionLoading) {
              handleManualRefresh();
            }
          },
          ariaLabel: 'Refresh position data',
        }}
      />

      <ModalBody className="gap-4">
        {mode === 'manual' ? (
          <>
            <div>
              <p className="mb-2 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">From Markets</p>
              <FromMarketsTable
                positions={groupedPosition.markets
                  .filter((position) => BigInt(position.state.supplyShares) > 0n)
                  .map((market) => ({
                    ...market,
                    pendingDelta: getPendingDelta(market.market.uniqueKey),
                  }))}
                selectedMarketUniqueKey={selectedFromMarketUniqueKey}
                onSelectMarket={setSelectedFromMarketUniqueKey}
                onSelectMax={handleMaxSelect}
              />
            </div>

            <div>
              <p className="mb-2 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Add Action</p>
              <RebalanceActionInput
                amount={amount}
                setAmount={setAmount}
                selectedFromMarketUniqueKey={selectedFromMarketUniqueKey}
                selectedToMarketUniqueKey={selectedToMarketUniqueKey}
                groupedPosition={groupedPosition}
                eligibleMarkets={eligibleMarkets}
                token={{
                  address: groupedPosition.loanAssetAddress,
                  chainId: groupedPosition.chainId,
                }}
                onAddAction={handleAddAction}
                onToMarketClick={() =>
                  openModal('rebalanceMarketSelection', {
                    vaultAsset: groupedPosition.loanAssetAddress as `0x${string}`,
                    chainId: groupedPosition.chainId as SupportedNetworks,
                    multiSelect: false,
                    onSelect: (selectedMarkets) => {
                      if (selectedMarkets.length > 0) {
                        setSelectedToMarketUniqueKey(selectedMarkets[0].uniqueKey);
                      }
                      closeModal('rebalanceMarketSelection');
                    },
                  })
                }
                onClearToMarket={() => setSelectedToMarketUniqueKey('')}
              />
            </div>

            <RebalanceCart
              rebalanceActions={rebalanceActions}
              groupedPosition={groupedPosition}
              eligibleMarkets={eligibleMarkets}
              removeRebalanceAction={removeRebalanceAction}
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Market Allocation</p>
              {(isSmartCalculating || isSmartConstraintsPending) && (
                <div className="inline-flex items-center gap-1 text-xs text-secondary">
                  <Spinner size={12} />
                  Updating
                </div>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-surface text-left text-secondary">
                    <th className="px-2 py-1.5 font-medium">Market</th>
                    <th className="px-2 py-1.5 text-right font-medium">Current Allocation</th>
                    <th className="px-2 py-1.5 text-right font-medium">Final Allocation</th>
                    <th className="px-2 py-1.5 text-right font-medium">Delta</th>
                    <th className="px-2 py-1.5 text-right font-medium">Post {rateLabel}</th>
                    <th className="px-2 py-1.5 text-right font-medium">Max %</th>
                  </tr>
                </thead>
                <tbody>
                  {smartRows.map((row) => {
                    const committedMaxAllocationValue = (smartMaxAllocationBps[row.market.uniqueKey] ?? 10_000) / 100;
                    const maxAllocationValue =
                      smartMaxAllocationInputValues[row.market.uniqueKey] ?? formatMaxAllocationInput(committedMaxAllocationValue);

                    return (
                      <tr
                        key={row.market.uniqueKey}
                        className="border-b border-border/40"
                      >
                        <td className="px-2 py-2">
                          <MarketIdentity
                            market={row.market}
                            chainId={groupedPosition.chainId}
                            mode={MarketIdentityMode.Minimum}
                            focus={MarketIdentityFocus.Collateral}
                            showLltv
                            showOracle
                            showId={false}
                            iconSize={16}
                            showExplorerLink={false}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <TokenIcon
                              address={groupedPosition.loanAssetAddress as `0x${string}`}
                              chainId={groupedPosition.chainId}
                              symbol={groupedPosition.loanAssetSymbol}
                              width={12}
                              height={12}
                            />
                            <AllocationCell
                              amount={row.currentAmountDisplay}
                              percentage={row.currentShare}
                              compact
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <TokenIcon
                              address={groupedPosition.loanAssetAddress as `0x${string}`}
                              chainId={groupedPosition.chainId}
                              symbol={groupedPosition.loanAssetSymbol}
                              width={12}
                              height={12}
                            />
                            <AllocationCell
                              amount={row.targetAmountDisplay}
                              percentage={row.targetShare}
                              compact
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span
                            className={row.amountDelta > 0n ? 'text-green-600' : row.amountDelta < 0n ? 'text-red-500' : 'text-secondary'}
                          >
                            {row.amountDelta > 0n ? '+' : ''}
                            {fmtAmount(row.amountDelta)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="font-medium">{formatRate(row.projectedApy, isAprDisplay)}</div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="ml-auto flex w-fit items-center gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={maxAllocationValue}
                              onChange={(event) => handleMaxAllocationInputChange(row.market.uniqueKey, event.target.value)}
                              onBlur={() => handleMaxAllocationInputBlur(row.market.uniqueKey)}
                              className="h-7 w-16 rounded-sm border border-border bg-background px-1.5 text-right text-xs"
                            />
                            <button
                              type="button"
                              aria-label="Delete market from smart rebalance"
                              onClick={() => handleDeleteSmartMarket(row.market.uniqueKey)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border/60 text-secondary transition hover:text-red-500"
                            >
                              <FiTrash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-surface/40">
                    <td
                      colSpan={5}
                      className="px-2 py-2"
                    >
                      <button
                        type="button"
                        onClick={handleAddSmartMarkets}
                        className="inline-flex items-center gap-1 text-sm text-secondary transition hover:text-primary"
                      >
                        <span className="text-base leading-none">+</span>
                        Add market
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSmartMaxAllocationBps({});
                          setSmartMaxAllocationInputValues({});
                        }}
                        className="text-xs text-secondary transition hover:text-foreground"
                      >
                        Reset limits
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {smartCalculationError && <div className="text-sm text-red-500">{smartCalculationError}</div>}
            {!isSmartCalculating && smartPlan && smartTotalMoved > 0n && !isSmartFeeReady && (
              <div className="text-sm text-red-500">Waiting for loan asset USD price to enforce the smart rebalance fee cap.</div>
            )}
            {!isSmartCalculating && constraintViolations.length > 0 && (
              <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-300">
                Some max-allocation limits could not be fully satisfied due to current market liquidity/capacity.
              </div>
            )}

            {smartPlan && (
              <PreviewSection
                title="Transaction Preview"
                rows={smartFeePreviewRow == null ? smartPreviewRows : [...smartPreviewRows, smartFeePreviewRow]}
              />
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter className="mx-2">
        <Button
          variant="default"
          onClick={() => onOpenChange(false)}
          className="rounded-sm p-4 px-10 font-zen text-secondary duration-200 ease-in-out hover:scale-105"
        >
          Cancel
        </Button>

        {mode === 'manual' ? (
          <ExecuteTransactionButton
            targetChainId={groupedPosition.chainId}
            onClick={handleExecuteManualRebalance}
            disabled={rebalanceActions.length === 0}
            isLoading={isManualProcessing}
            variant="primary"
            className="rounded-sm p-4 px-10 font-zen text-white duration-200 ease-in-out hover:scale-105 disabled:opacity-50"
          >
            Execute Rebalance
          </ExecuteTransactionButton>
        ) : (
          <ExecuteTransactionButton
            targetChainId={groupedPosition.chainId}
            onClick={handleExecuteSmartRebalance}
            disabled={!smartCanExecute}
            isLoading={isSmartProcessing}
            variant="primary"
            className="rounded-sm p-4 px-10 font-zen text-white duration-200 ease-in-out hover:scale-105 disabled:opacity-50"
          >
            {isSmartWithdrawOnly ? 'Batch Withdraw' : 'Smart Rebalance'}
          </ExecuteTransactionButton>
        )}
      </ModalFooter>
    </Modal>
  );
}
