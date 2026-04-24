import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Address, encodeFunctionData, getAddress, isAddress } from 'viem';
import morphoBundlerAbi from '@/abis/bundlerV2';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GAS_COSTS } from '@/features/markets/components/constants';
import { useRebalanceExecution } from '@/hooks/useRebalanceExecution';
import { useStyledToast } from '@/hooks/useStyledToast';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getBundlerV2 } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import type { GroupedPosition, MarketPositionWithEarnings } from '@/utils/types';
import { useConnection } from 'wagmi';

type GroupedPositionActionIntent = 'withdraw' | 'transfer';

type GroupedPositionActionModalProps = {
  groupedPosition: GroupedPosition;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
};

const modeOptions: Array<{ value: GroupedPositionActionIntent; label: string }> = [
  { value: 'withdraw', label: 'Withdraw' },
  { value: 'transfer', label: 'Transfer' },
];

function getMarketParams(position: MarketPositionWithEarnings) {
  return {
    loanToken: position.market.loanAsset.address as Address,
    collateralToken: position.market.collateralAsset.address as Address,
    oracle: position.market.oracleAddress as Address,
    irm: position.market.irmAddress as Address,
    lltv: BigInt(position.market.lltv),
  };
}

export function GroupedPositionActionModal({
  groupedPosition,
  isOpen,
  onOpenChange,
  refetch,
  isRefetching,
}: GroupedPositionActionModalProps): JSX.Element {
  const toast = useStyledToast();
  const { address: account } = useConnection();

  const [mode, setMode] = useState<GroupedPositionActionIntent>('withdraw');
  const [selectedMarketKeys, setSelectedMarketKeys] = useState<Set<string>>(new Set());
  const [recipientAddressInput, setRecipientAddressInput] = useState('');

  const accountAddress = useMemo(() => {
    if (!account || !isAddress(account)) return null;
    return getAddress(account);
  }, [account]);

  const suppliedPositions = useMemo(
    () => groupedPosition.markets.filter((position) => BigInt(position.state.supplyAssets) > 0n),
    [groupedPosition.markets],
  );

  const illiquidMarketKeys = useMemo(
    () =>
      new Set(
        suppliedPositions
          .filter((position) => {
            const positionAssets = BigInt(position.state.supplyAssets);
            const marketLiquidity = BigInt(position.market.state.liquidityAssets);
            return positionAssets > marketLiquidity;
          })
          .map((position) => position.market.uniqueKey),
      ),
    [suppliedPositions],
  );

  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!isOpen || wasOpen) return;

    setMode('withdraw');
    setRecipientAddressInput('');
    setSelectedMarketKeys(
      new Set(
        suppliedPositions
          .filter((position) => !illiquidMarketKeys.has(position.market.uniqueKey))
          .map((position) => position.market.uniqueKey),
      ),
    );
  }, [illiquidMarketKeys, isOpen, suppliedPositions]);

  const selectedPositions = useMemo(
    () => suppliedPositions.filter((position) => selectedMarketKeys.has(position.market.uniqueKey)),
    [selectedMarketKeys, suppliedPositions],
  );

  const selectedTotalAssets = useMemo(
    () => selectedPositions.reduce((sum, position) => sum + BigInt(position.state.supplyAssets), 0n),
    [selectedPositions],
  );

  const liquidityShortfallPositions = useMemo(
    () => selectedPositions.filter((position) => illiquidMarketKeys.has(position.market.uniqueKey)),
    [illiquidMarketKeys, selectedPositions],
  );

  const transferRecipient = useMemo(() => {
    if (!recipientAddressInput.trim()) return null;
    if (!isAddress(recipientAddressInput)) return null;
    return getAddress(recipientAddressInput);
  }, [recipientAddressInput]);

  const selectedTotalFormatted = useMemo(
    () => formatReadable(formatBalance(selectedTotalAssets, groupedPosition.loanAssetDecimals), 4),
    [groupedPosition.loanAssetDecimals, selectedTotalAssets],
  );

  const bundlerAddress = getBundlerV2(groupedPosition.chainId as SupportedNetworks);

  const handleSuccess = useCallback(() => {
    refetch(() => {
      toast.info('Data refreshed', 'Position data updated after grouped action.');
    });
    onOpenChange(false);
  }, [onOpenChange, refetch, toast]);

  const execution = useRebalanceExecution({
    chainId: groupedPosition.chainId,
    loanAssetAddress: groupedPosition.loanAssetAddress as Address,
    loanAssetSymbol: groupedPosition.loanAsset,
    requiredAmount: selectedTotalAssets,
    trackingType: 'grouped-position-action',
    toastId: 'grouped-position-action',
    pendingText: mode === 'withdraw' ? 'Withdrawing grouped positions' : 'Transferring grouped positions',
    successText: mode === 'withdraw' ? 'Grouped withdraw completed' : 'Grouped transfer completed',
    errorText: mode === 'withdraw' ? 'Failed to withdraw grouped positions' : 'Failed to transfer grouped positions',
    onSuccess: handleSuccess,
  });

  const canExecute =
    selectedPositions.length > 0 && liquidityShortfallPositions.length === 0 && (mode === 'withdraw' || transferRecipient != null);

  const execute = useCallback(async () => {
    if (!account) {
      toast.error('No account connected', 'Please connect your wallet to continue.');
      return;
    }

    if (selectedPositions.length === 0) {
      toast.info('No positions selected', 'Select at least one supplied position.');
      return;
    }

    if (liquidityShortfallPositions.length > 0) {
      toast.error('Insufficient market liquidity', 'Use single-market withdraw for liquidity sourcing on affected markets.');
      return;
    }

    if (mode === 'transfer' && !transferRecipient) {
      toast.error('Invalid recipient', 'Enter a valid recipient address.');
      return;
    }

    if (mode === 'transfer' && transferRecipient === accountAddress) {
      toast.info('Same recipient', 'Choose a different address to move this position.');
      return;
    }

    const withdrawReceiver = mode === 'transfer' ? bundlerAddress : account;

    const withdrawTxs: `0x${string}`[] = [];
    const supplyTxs: `0x${string}`[] = [];

    for (const position of selectedPositions) {
      if (
        !position.market.loanAsset?.address ||
        !position.market.collateralAsset?.address ||
        !position.market.oracleAddress ||
        !position.market.irmAddress
      ) {
        toast.error('Market data missing', `Missing market params for ${position.market.uniqueKey.slice(0, 8)}.`);
        return;
      }

      const fullShares = BigInt(position.state.supplyShares);
      const expectedAssets = BigInt(position.state.supplyAssets);

      if (fullShares <= 0n || expectedAssets <= 0n) continue;

      withdrawTxs.push(
        encodeFunctionData({
          abi: morphoBundlerAbi,
          functionName: 'morphoWithdraw',
          args: [getMarketParams(position), 0n, fullShares, expectedAssets, withdrawReceiver],
        }),
      );

      if (mode === 'transfer' && transferRecipient) {
        supplyTxs.push(
          encodeFunctionData({
            abi: morphoBundlerAbi,
            functionName: 'morphoSupply',
            args: [getMarketParams(position), 0n, fullShares, 0n, transferRecipient, '0x'],
          }),
        );
      }
    }

    if (withdrawTxs.length === 0) {
      toast.info('Nothing to execute', 'Selected positions do not have withdrawable supply.');
      return;
    }

    const baseOverhead =
      GAS_COSTS.BUNDLER_REBALANCE > GAS_COSTS.SINGLE_WITHDRAW + GAS_COSTS.SINGLE_SUPPLY
        ? GAS_COSTS.BUNDLER_REBALANCE - GAS_COSTS.SINGLE_WITHDRAW - GAS_COSTS.SINGLE_SUPPLY
        : 0n;
    const gasEstimate =
      baseOverhead + GAS_COSTS.SINGLE_WITHDRAW * BigInt(withdrawTxs.length) + GAS_COSTS.SINGLE_SUPPLY * BigInt(supplyTxs.length);

    await execution.executeBundle({
      metadata: {
        title: mode === 'withdraw' ? 'Grouped Withdraw' : 'Grouped Transfer',
        description:
          mode === 'withdraw'
            ? `Withdraw ${groupedPosition.loanAsset} from selected supplied positions.`
            : `Withdraw and resupply ${groupedPosition.loanAsset} to ${transferRecipient}.`,
        tokenSymbol: groupedPosition.loanAsset,
        summaryItems: [
          {
            id: 'positions',
            label: 'Selected positions',
            value: String(selectedPositions.length),
          },
          {
            id: 'amount',
            label: `Total ${groupedPosition.loanAsset}`,
            value: selectedTotalFormatted,
          },
        ],
      },
      withdrawTxs,
      supplyTxs,
      gasEstimate,
      requiresAssetTransfer: false,
    });
  }, [
    account,
    bundlerAddress,
    execution,
    groupedPosition.loanAsset,
    liquidityShortfallPositions.length,
    mode,
    selectedPositions,
    selectedTotalFormatted,
    toast,
    transferRecipient,
    accountAddress,
  ]);

  const toggleMarketSelection = useCallback((marketUniqueKey: string, checked: boolean) => {
    setSelectedMarketKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(marketUniqueKey);
      } else {
        next.delete(marketUniqueKey);
      }
      return next;
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      className="w-full max-w-2xl"
      scrollBehavior="inside"
    >
      <ModalHeader
        title={
          <ModalIntentSwitcher
            value={mode}
            options={modeOptions}
            onValueChange={(nextMode) => setMode(nextMode as GroupedPositionActionIntent)}
          />
        }
        description={
          mode === 'withdraw'
            ? `Withdraw your selected ${groupedPosition.loanAsset} supplied positions.`
            : 'Transfer selected supplied positions to another address via withdraw + resupply.'
        }
        mainIcon={
          <TokenIcon
            address={groupedPosition.loanAssetAddress}
            chainId={groupedPosition.chainId}
            symbol={groupedPosition.loanAssetSymbol}
            width={24}
            height={24}
          />
        }
        onClose={() => onOpenChange(false)}
      />

      <ModalBody className="gap-4">
        <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Selection</p>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="surface"
                onClick={() =>
                  setSelectedMarketKeys(
                    new Set(
                      suppliedPositions
                        .filter((position) => !illiquidMarketKeys.has(position.market.uniqueKey))
                        .map((position) => position.market.uniqueKey),
                    ),
                  )
                }
              >
                Select All
              </Button>
              <Button
                size="xs"
                variant="surface"
                onClick={() => setSelectedMarketKeys(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {suppliedPositions.map((position) => {
              const marketKey = position.market.uniqueKey;
              const checked = selectedMarketKeys.has(marketKey);
              const isIlliquid = illiquidMarketKeys.has(marketKey);
              const supplied = formatReadable(formatBalance(position.state.supplyAssets, groupedPosition.loanAssetDecimals), 4);

              return (
                <div
                  key={marketKey}
                  className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${
                    isIlliquid ? 'border-yellow-500/30 bg-yellow-500/5 opacity-70' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={checked}
                      disabled={isIlliquid}
                      onCheckedChange={(next) => {
                        if (isIlliquid) return;
                        toggleMarketSelection(marketKey, next === true);
                      }}
                    />
                    <div className="text-xs">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {position.market.collateralAsset.symbol} / {groupedPosition.loanAssetSymbol}
                        </p>
                        {isIlliquid && (
                          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-yellow-200">
                            Illiquid
                          </span>
                        )}
                      </div>
                      <p className="text-secondary">{marketKey.slice(0, 10)}...</p>
                    </div>
                  </div>
                  <p className="text-xs font-medium tabular-nums">
                    {supplied} {groupedPosition.loanAssetSymbol}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {mode === 'transfer' && (
          <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
            <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Recipient Address</p>
            <input
              value={recipientAddressInput}
              onChange={(event) => setRecipientAddressInput(event.target.value)}
              placeholder="0x..."
              className="h-10 w-full rounded border border-white/10 bg-surface px-3 py-2 font-mono text-sm"
            />
            {recipientAddressInput.length > 0 && !transferRecipient && (
              <p className="mt-1 text-xs text-red-400">Enter a valid EVM address.</p>
            )}
          </div>
        )}

        <div className="rounded border border-white/10 bg-hovered px-3 py-2.5 text-xs">
          <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">Summary</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-secondary">Selected positions</span>
              <span className="tabular-nums">{selectedPositions.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Total {groupedPosition.loanAssetSymbol}</span>
              <span className="tabular-nums">{selectedTotalFormatted}</span>
            </div>
            {isRefetching && <p className="text-secondary">Refreshing position data...</p>}
          </div>
        </div>

        {liquidityShortfallPositions.length > 0 && (
          <div className="rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
            Some selected markets currently have less available liquidity than your full supplied amount. Use single-market withdraw to
            retain Public Allocator liquidity sourcing.
          </div>
        )}
      </ModalBody>

      <ModalFooter className="justify-end gap-2">
        <Button
          variant="surface"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <ExecuteTransactionButton
          targetChainId={groupedPosition.chainId}
          onClick={() => {
            void execute();
          }}
          isLoading={execution.isProcessing}
          disabled={!canExecute || execution.isProcessing}
          variant="primary"
          className="min-w-36"
        >
          {mode === 'withdraw' ? 'Withdraw Selected' : 'Transfer Selected'}
        </ExecuteTransactionButton>
      </ModalFooter>
    </Modal>
  );
}
