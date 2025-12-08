import { useState } from 'react';
import { LuArrowRightLeft } from 'react-icons/lu';
import { useAccount, useBalance } from 'wagmi';
import { Button } from '@/components/common/Button';
import { Modal, ModalHeader, ModalBody } from '@/components/common/Modal';
import type { Market, MarketPosition } from '@/utils/types';
import { AddCollateralAndBorrow } from './Borrow/AddCollateralAndBorrow';
import { WithdrawCollateralAndRepay } from './Borrow/WithdrawCollateralAndRepay';
import { TokenIcon } from './TokenIcon';

type BorrowModalProps = {
  market: Market;
  onOpenChange: (open: boolean) => void;
  oraclePrice: bigint;
  refetch?: () => void;
  isRefreshing?: boolean;
  position: MarketPosition | null;
};

export function BorrowModal({ market, onOpenChange, oraclePrice, refetch, isRefreshing = false, position }: BorrowModalProps): JSX.Element {
  const [mode, setMode] = useState<'borrow' | 'repay'>('borrow');
  const { address: account } = useAccount();

  // Get token balances
  const { data: loanTokenBalance } = useBalance({
    token: market.loanAsset.address as `0x${string}`,
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  const { data: collateralTokenBalance } = useBalance({
    token: market.collateralAsset.address as `0x${string}`,
    address: account,
    chainId: market.morphoBlue.chain.id,
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
              variant="light"
              size="sm"
              onPress={() => setMode(mode === 'borrow' ? 'repay' : 'borrow')}
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
            collateralTokenBalance={collateralTokenBalance?.value}
            ethBalance={ethBalance?.value}
            oraclePrice={oraclePrice}
            onSuccess={refetch}
            isRefreshing={isRefreshing}
          />
        ) : (
          <WithdrawCollateralAndRepay
            market={market}
            currentPosition={position}
            loanTokenBalance={loanTokenBalance?.value}
            collateralTokenBalance={collateralTokenBalance?.value}
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
