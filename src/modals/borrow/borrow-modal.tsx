import { useState } from 'react';
import { LuArrowRightLeft } from 'react-icons/lu';
import { useConnection, useReadContract, useBalance } from 'wagmi';
import { erc20Abi } from 'viem';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody } from '@/components/common/Modal';
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
  liquiditySourcing?: LiquiditySourcingResult;
};

export function BorrowModal({ market, onOpenChange, oraclePrice, refetch, isRefreshing = false, position, liquiditySourcing }: BorrowModalProps): JSX.Element {
  const [mode, setMode] = useState<'borrow' | 'repay'>('borrow');
  const { address: account } = useConnection();

  // Get token balances
  const { data: loanTokenBalance } = useReadContract({
    address: market.loanAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account,
    },
  });

  const { data: collateralTokenBalance } = useReadContract({
    address: market.collateralAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account,
    },
  });

  const { data: ethBalance } = useBalance({
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  const hasPosition = position && (BigInt(position.state.borrowAssets) > 0n || BigInt(position.state.collateral) > 0n);

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
            <span>{market.loanAsset.symbol}</span>
            <span className="text-xs opacity-50">/ {market.collateralAsset.symbol}</span>
          </div>
        }
        description={mode === 'borrow' ? 'Borrow against collateral' : 'Repay borrowed assets'}
        actions={
          hasPosition ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === 'borrow' ? 'repay' : 'borrow')}
              className="flex items-center gap-1.5"
            >
              <LuArrowRightLeft className="h-3 w-3 rotate-90" />
              {mode === 'borrow' ? 'Repay' : 'Borrow'}
            </Button>
          ) : undefined
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
            onSuccess={refetch}
            isRefreshing={isRefreshing}
            liquiditySourcing={liquiditySourcing}
          />
        ) : (
          <WithdrawCollateralAndRepay
            market={market}
            currentPosition={position}
            loanTokenBalance={loanTokenBalance}
            collateralTokenBalance={collateralTokenBalance}
            ethBalance={ethBalance?.value}
            oraclePrice={oraclePrice}
            onSuccess={refetch}
            isRefreshing={isRefreshing}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
