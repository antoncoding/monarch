import { useCallback, useState } from 'react';
import { erc20Abi } from 'viem';
import { useConnection, useReadContract } from 'wagmi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
import { TokenIcon } from '@/components/shared/token-icon';
import { Badge } from '@/components/ui/badge';
import { useLeverageSupport } from '@/hooks/useLeverageSupport';
import type { Market, MarketPosition } from '@/utils/types';
import { AddCollateralAndLeverage } from './components/add-collateral-and-leverage';
import { RemoveCollateralAndDeleverage } from './components/remove-collateral-and-deleverage';

type LeverageModalProps = {
  market: Market;
  onOpenChange: (open: boolean) => void;
  oraclePrice: bigint;
  refetch?: () => void;
  isRefreshing?: boolean;
  position: MarketPosition | null;
  defaultMode?: 'leverage' | 'deleverage';
  toggleLeverageDeleverage?: boolean;
};

export function LeverageModal({
  market,
  onOpenChange,
  oraclePrice,
  refetch,
  isRefreshing = false,
  position,
  defaultMode = 'leverage',
  toggleLeverageDeleverage = true,
}: LeverageModalProps): JSX.Element {
  const [mode, setMode] = useState<'leverage' | 'deleverage'>(defaultMode);
  const { address: account } = useConnection();
  const support = useLeverageSupport({ market });
  const isErc4626Route = support.route?.kind === 'erc4626';
  const isSwapRoute = support.route?.kind === 'swap';

  const effectiveMode = mode;
  const modeOptions: { value: string; label: string }[] = toggleLeverageDeleverage
    ? [
        { value: 'leverage', label: `Leverage ${market.collateralAsset.symbol}` },
        { value: 'deleverage', label: `Deleverage ${market.collateralAsset.symbol}` },
      ]
    : [
        {
          value: effectiveMode,
          label: effectiveMode === 'leverage' ? `Leverage ${market.collateralAsset.symbol}` : `Deleverage ${market.collateralAsset.symbol}`,
        },
      ];

  const {
    data: collateralTokenBalance,
    refetch: refetchCollateralTokenBalance,
    isFetching: isFetchingCollateralTokenBalance,
  } = useReadContract({
    address: market.collateralAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account,
    },
  });

  const handleRefreshAll = useCallback(() => {
    const tasks: Promise<unknown>[] = [];
    if (refetch) tasks.push(Promise.resolve(refetch()));
    if (account) tasks.push(refetchCollateralTokenBalance());
    if (tasks.length > 0) void Promise.allSettled(tasks);
  }, [refetch, account, refetchCollateralTokenBalance]);

  const isRefreshingAnyData = isRefreshing || isFetchingCollateralTokenBalance;

  const mainIcon = (
    <div className="flex -space-x-2">
      <TokenIcon
        address={market.loanAsset.address}
        chainId={market.morphoBlue.chain.id}
        symbol={market.loanAsset.symbol}
        width={24}
        height={24}
      />
      <div className="rounded-full border border-gray-800">
        <TokenIcon
          address={market.collateralAsset.address}
          chainId={market.morphoBlue.chain.id}
          symbol={market.collateralAsset.symbol}
          width={24}
          height={24}
        />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
    >
      <ModalHeader
        mainIcon={mainIcon}
        onClose={() => onOpenChange(false)}
        title={
          <div className="flex items-center gap-2">
            <ModalIntentSwitcher
              value={effectiveMode}
              options={modeOptions}
              onValueChange={(nextMode) => setMode(nextMode as 'leverage' | 'deleverage')}
            />
            {isErc4626Route && (
              <Badge
                variant="success"
                size="sm"
                className="uppercase tracking-[0.08em]"
              >
                #ERC4626
              </Badge>
            )}
            {isSwapRoute && (
              <Badge
                variant="warning"
                size="sm"
                className="uppercase tracking-[0.08em]"
              >
                #SWAP
              </Badge>
            )}
          </div>
        }
        description={
          effectiveMode === 'leverage'
            ? isErc4626Route
              ? `Leverage ERC4626 vault exposure by looping ${market.loanAsset.symbol} into ${market.collateralAsset.symbol}.`
              : isSwapRoute
                ? `Leverage ${market.collateralAsset.symbol} exposure through Bundler3 + Velora swap routing.`
                : `Leverage your ${market.collateralAsset.symbol} exposure by looping.`
            : isErc4626Route
              ? `Reduce ERC4626 leveraged exposure by unwinding your ${market.collateralAsset.symbol} loop.`
              : isSwapRoute
                ? `Deleverage is not yet available for the swap route on this market.`
                : `Reduce leveraged ${market.collateralAsset.symbol} exposure by unwinding your loop.`
        }
      />
      <ModalBody>
        {support.isSupported ? (
          effectiveMode === 'leverage' ? (
            <AddCollateralAndLeverage
              market={market}
              support={support}
              currentPosition={position}
              collateralTokenBalance={collateralTokenBalance}
              oraclePrice={oraclePrice}
              onSuccess={handleRefreshAll}
              isRefreshing={isRefreshingAnyData}
            />
          ) : support.supportsDeleverage ? (
            <RemoveCollateralAndDeleverage
              market={market}
              support={support}
              currentPosition={position}
              oraclePrice={oraclePrice}
              onSuccess={handleRefreshAll}
              isRefreshing={isRefreshingAnyData}
            />
          ) : (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {support.reason ?? 'Deleverage is not available for this route.'}
            </div>
          )
        ) : support.isLoading ? (
          <div className="rounded border border-white/10 bg-hovered p-4 text-sm text-secondary">Checking leverage route support...</div>
        ) : (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {support.reason ?? 'This market is not supported by the V2 leverage routes.'}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
