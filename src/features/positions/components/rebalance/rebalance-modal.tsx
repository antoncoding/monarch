import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Badge } from '@/components/ui/badge';
import { useModalStore } from '@/stores/useModalStore';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useRebalance } from '@/hooks/useRebalance';
import { useSmartRebalance } from '@/hooks/useSmartRebalance';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import type { Market } from '@/utils/types';
import type { GroupedPosition, RebalanceAction } from '@/utils/types';
import { formatBalance, formatReadable } from '@/utils/balance';
import { convertApyToApr } from '@/utils/rateMath';
import { calculateSmartRebalancePlan, type SmartRebalancePlan } from '@/features/positions/smart-rebalance/planner';
import type { SmartRebalanceConstraintMap } from '@/features/positions/smart-rebalance/types';
import type { TransactionSummaryItem } from '@/stores/useTransactionProcessStore';
import type { SupportedNetworks } from '@/utils/networks';
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

type RebalanceMode = 'manual' | 'smart';

const modeOptions: { value: RebalanceMode; label: string }[] = [
  { value: 'smart', label: 'Smart Rebalance' },
  { value: 'manual', label: 'Manual Rebalance' },
];
const SMART_REBALANCE_RECALC_DEBOUNCE_MS = 300;

function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

function formatRate(apy: number, isAprDisplay: boolean): string {
  if (!Number.isFinite(apy)) return '-';
  const displayRate = isAprDisplay ? convertApyToApr(apy) : apy;
  if (!Number.isFinite(displayRate)) return '-';
  return formatPercent(displayRate * 100, 2);
}

type PreviewRow = {
  label: string;
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
            key={row.label}
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
  const [debouncedSmartMaxAllocationBps, setDebouncedSmartMaxAllocationBps] = useState<Record<string, number>>({});
  const [smartPlan, setSmartPlan] = useState<SmartRebalancePlan | null>(null);
  const [isSmartCalculating, setIsSmartCalculating] = useState(false);
  const [smartCalculationError, setSmartCalculationError] = useState<string | null>(null);

  const calcIdRef = useRef(0);

  const toast = useStyledToast();
  const { isAprDisplay } = useAppSettings();
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
  } = useSmartRebalance(groupedPosition, smartPlan, handleSmartTxSuccess);

  const eligibleMarkets = useMemo(() => {
    return markets.filter(
      (market) => market.loanAsset.address === groupedPosition.loanAssetAddress && market.morphoBlue.chain.id === groupedPosition.chainId,
    );
  }, [markets, groupedPosition.loanAssetAddress, groupedPosition.chainId]);

  const currentSupplyByMarket = useMemo(
    () => new Map(groupedPosition.markets.map((position) => [position.market.uniqueKey, BigInt(position.state.supplyAssets)])),
    [groupedPosition.markets],
  );

  const marketByKey = useMemo(() => new Map(eligibleMarkets.map((market) => [market.uniqueKey, market])), [eligibleMarkets]);

  const defaultSmartMarketKeys = useMemo(
    () =>
      groupedPosition.markets.filter((position) => BigInt(position.state.supplyAssets) > 0n).map((position) => position.market.uniqueKey),
    [groupedPosition.markets],
  );

  useEffect(() => {
    if (!isOpen) return;
    setMode('smart');
    setSmartSelectedMarketKeys(new Set(defaultSmartMarketKeys));
    setSmartMaxAllocationBps({});
    setDebouncedSmartMaxAllocationBps({});
    setSmartPlan(null);
    setSmartCalculationError(null);
  }, [defaultSmartMarketKeys, isOpen]);

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

    void calculateSmartRebalancePlan({
      groupedPosition,
      chainId: groupedPosition.chainId as SupportedNetworks,
      candidateMarkets: eligibleMarkets,
      includedMarketKeys: smartSelectedMarketKeys,
      constraints,
    })
      .then((plan) => {
        if (id !== calcIdRef.current) return;
        setSmartPlan(plan);
      })
      .catch((error: unknown) => {
        if (id !== calcIdRef.current) return;
        setSmartPlan(null);
        const message = error instanceof Error ? error.message : 'Failed to calculate smart rebalance plan.';
        setSmartCalculationError(message);
      })
      .finally(() => {
        if (id !== calcIdRef.current) return;
        setIsSmartCalculating(false);
      });
  }, [debouncedSmartMaxAllocationBps, eligibleMarkets, groupedPosition, isOpen, mode, smartSelectedMarketKeys]);

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

  const smartSummaryItems = useMemo((): TransactionSummaryItem[] => {
    if (!smartPlan) return [];

    const items: TransactionSummaryItem[] = [
      {
        label: `Weighted ${rateLabel}`,
        value: `${formatPercent(smartCurrentWeightedRate * 100)} → ${formatPercent(smartProjectedWeightedRate * 100)}`,
        detail: `(${smartWeightedRateDiff >= 0 ? '+' : ''}${formatPercent(smartWeightedRateDiff * 100)})`,
        detailColor: smartWeightedRateDiff >= 0 ? 'positive' : 'negative',
      },
    ];

    if (smartTotalMoved > 0n) {
      items.push({
        label: 'Capital moved',
        value: fmtAmount(smartTotalMoved),
      });
      items.push({
        label: 'Fee (0.01%)',
        value: fmtAmount(smartFeeAmount),
      });
    }

    return items;
  }, [
    fmtAmount,
    rateLabel,
    smartCurrentWeightedRate,
    smartFeeAmount,
    smartPlan,
    smartProjectedWeightedRate,
    smartTotalMoved,
    smartWeightedRateDiff,
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

    if (sourceEntries.length !== debouncedEntries.length) return true;

    for (let index = 0; index < sourceEntries.length; index++) {
      if (sourceEntries[index][0] !== debouncedEntries[index][0] || sourceEntries[index][1] !== debouncedEntries[index][1]) {
        return true;
      }
    }

    return false;
  }, [debouncedSmartMaxAllocationBps, smartMaxAllocationBps]);

  const smartCanExecute = !isSmartCalculating && !isSmartConstraintsPending && !!smartPlan && smartTotalMoved > 0n;

  const handleDeleteSmartMarket = useCallback(
    (uniqueKey: string) => {
      const currentAmount = currentSupplyByMarket.get(uniqueKey) ?? 0n;

      if (currentAmount > 0n) {
        setSmartMaxAllocationBps((prev) => ({
          ...prev,
          [uniqueKey]: 0,
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
        const { [uniqueKey]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [currentSupplyByMarket],
  );

  const updateMaxAllocation = useCallback((uniqueKey: string, rawValue: string) => {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return;

    const clamped = Math.max(0, Math.min(100, numeric));
    const nextBps = Math.round(clamped * 100);

    setSmartMaxAllocationBps((prev) => ({
      ...prev,
      [uniqueKey]: nextBps,
    }));
  }, []);

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
    void executeSmartRebalance(smartSummaryItems);
  }, [executeSmartRebalance, smartSummaryItems]);

  const handleManualRefresh = () => {
    refetch(() => {
      toast.info('Data refreshed', 'Position data updated', {
        icon: <span>🚀</span>,
      });
    });
  };

  const smartPreviewRows = useMemo<PreviewRow[]>(
    () => [
      {
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
      {
        label: 'Capital moved',
        value: fmtAmount(smartTotalMoved),
      },
      {
        label: 'Fee (0.01%)',
        value: fmtAmount(smartFeeAmount),
      },
    ],
    [fmtAmount, rateLabel, smartCurrentWeightedRate, smartFeeAmount, smartProjectedWeightedRate, smartTotalMoved, smartWeightedRateDiff],
  );

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
          icon: <RefetchIcon isLoading={isRefetching} />,
          onClick: () => {
            if (!isRefetching) {
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
                    const maxAllocationValue = (smartMaxAllocationBps[row.market.uniqueKey] ?? 10_000) / 100;

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
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={maxAllocationValue}
                              onChange={(event) => updateMaxAllocation(row.market.uniqueKey, event.target.value)}
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
                        onClick={() => setSmartMaxAllocationBps({})}
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
            {!isSmartCalculating && constraintViolations.length > 0 && (
              <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-300">
                Some max-allocation limits could not be fully satisfied due current market liquidity/capacity.
              </div>
            )}

            {smartPlan && (
              <PreviewSection
                title="Transaction Preview"
                rows={smartPreviewRows}
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
