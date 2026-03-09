import { useCallback, useEffect, useState } from 'react';
import { useConnection, useReadContract, useBalance } from 'wagmi';
import { erc20Abi } from 'viem';
import { Modal, ModalHeader, ModalBody } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
import type { Market, MarketPosition } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { AddCollateralAndBorrow } from './components/add-collateral-and-borrow';
import { WithdrawCollateralAndRepay } from './components/withdraw-collateral-and-repay';
import { TokenIcon } from '@/components/shared/token-icon';

type BorrowModalProps = {
  market: Market;
  onOpenChange: (open: boolean) => void;
  oraclePrice: bigint;
  refetch?: () => void;
  isRefreshing?: boolean;
  position: MarketPosition | null;
  defaultMode?: 'borrow' | 'repay';
  toggleBorrowRepay?: boolean;
  liquiditySourcing?: LiquiditySourcingResult;
};

export function BorrowModal({
  market,
  onOpenChange,
  oraclePrice,
  refetch,
  isRefreshing = false,
  position,
  defaultMode = 'borrow',
  toggleBorrowRepay = true,
  liquiditySourcing,
}: BorrowModalProps): JSX.Element {
  const [mode, setMode] = useState<'borrow' | 'repay'>(() => defaultMode);
  const { address: account } = useConnection();

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const modeOptions: { value: string; label: string }[] = toggleBorrowRepay
    ? [
        { value: 'borrow', label: `Borrow ${market.loanAsset.symbol}` },
        { value: 'repay', label: `Repay ${market.loanAsset.symbol}` },
      ]
    : [{ value: mode, label: mode === 'borrow' ? `Borrow ${market.loanAsset.symbol}` : `Repay ${market.loanAsset.symbol}` }];

  // Get token balances
  const {
    data: loanTokenBalance,
    refetch: refetchLoanTokenBalance,
    isFetching: isFetchingLoanTokenBalance,
  } = useReadContract({
    address: market.loanAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account,
    },
  });

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

  const {
    data: ethBalance,
    refetch: refetchEthBalance,
    isFetching: isFetchingEthBalance,
  } = useBalance({
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  const handleRefreshAll = useCallback(() => {
    const tasks: Promise<unknown>[] = [];

    if (refetch) {
      tasks.push(Promise.resolve(refetch()));
    }

    if (account) {
      tasks.push(refetchLoanTokenBalance());
      tasks.push(refetchCollateralTokenBalance());
      tasks.push(refetchEthBalance());
    }

    if (tasks.length > 0) {
      void Promise.allSettled(tasks);
    }
  }, [refetch, account, refetchLoanTokenBalance, refetchCollateralTokenBalance, refetchEthBalance]);

  const isRefreshingAnyData = isRefreshing || isFetchingLoanTokenBalance || isFetchingCollateralTokenBalance || isFetchingEthBalance;

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
      className="!max-h-[92dvh]"
    >
      <ModalHeader
        mainIcon={mainIcon}
        onClose={() => onOpenChange(false)}
        title={
          <ModalIntentSwitcher
            value={mode}
            options={modeOptions}
            onValueChange={(nextMode) => setMode(nextMode as 'borrow' | 'repay')}
          />
        }
        description={
          mode === 'borrow'
            ? `Use ${market.collateralAsset.symbol} as collateral to borrow ${market.loanAsset.symbol}.`
            : `Repay ${market.loanAsset.symbol} debt to reduce risk and unlock ${market.collateralAsset.symbol} collateral.`
        }
      />
      <ModalBody>
        {mode === 'borrow' ? (
          <AddCollateralAndBorrow
            market={market}
            currentPosition={position}
            collateralTokenBalance={collateralTokenBalance}
            ethBalance={ethBalance?.value}
            oraclePrice={oraclePrice}
            onSuccess={handleRefreshAll}
            isRefreshing={isRefreshingAnyData}
            liquiditySourcing={liquiditySourcing}
          />
        ) : (
          <WithdrawCollateralAndRepay
            market={market}
            currentPosition={position}
            loanTokenBalance={loanTokenBalance}
            oraclePrice={oraclePrice}
            onSuccess={handleRefreshAll}
            isRefreshing={isRefreshingAnyData}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
