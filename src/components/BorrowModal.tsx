import React, { useState } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { useAccount, useBalance } from 'wagmi';
import useUserPosition from '@/hooks/useUserPosition';
import { Market } from '@/utils/types';
import { AddCollateralAndBorrow } from './Borrow/AddCollateralAndBorrow';
import { WithdrawCollateralAndRepay } from './Borrow/WithdrawCollateralAndRepay';
import ButtonGroup from './ButtonGroup';
import { TokenIcon } from './TokenIcon';

type BorrowModalProps = {
  market: Market;
  onClose: () => void;
};

export function BorrowModal({ market, onClose }: BorrowModalProps): JSX.Element {
  const [mode, setMode] = useState<'borrow' | 'repay'>('borrow');

  const { address: account } = useAccount();

  // Get user positions to calculate current LTV
  const { position: currentPosition, refetch: refetchPosition } = useUserPosition(
    account,
    market.morphoBlue.chain.id,
    market.uniqueKey,
  );

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

  const modeOptions = [
    { key: 'borrow', label: 'Borrow', value: 'borrow' },
    { key: 'repay', label: 'Repay', value: 'repay' },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50"
      style={{ zIndex: 50 }}
    >
      <div className="bg-surface relative w-full max-w-lg rounded-lg p-6">
        <div className="flex flex-col">
          <button
            type="button"
            className="bg-main absolute right-2 top-2 rounded-full p-1 text-primary hover:cursor-pointer"
            onClick={onClose}
          >
            <Cross1Icon />
          </button>

          <div className="mb-6 mr-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xl">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={20}
                height={20}
              />
              {market.loanAsset.symbol} Position
            </div>

            <ButtonGroup
              options={modeOptions}
              value={mode}
              onChange={(value) => setMode(value as 'borrow' | 'repay')}
              variant="default"
              size="sm"
            />
          </div>

          {mode === 'borrow' ? (
            <AddCollateralAndBorrow
              market={market}
              currentPosition={currentPosition}
              refetchPosition={refetchPosition}
              loanTokenBalance={loanTokenBalance?.value}
              collateralTokenBalance={collateralTokenBalance?.value}
              ethBalance={ethBalance?.value}
            />
          ) : (
            <WithdrawCollateralAndRepay
              market={market}
              currentPosition={currentPosition}
              refetchPosition={refetchPosition}
              loanTokenBalance={loanTokenBalance?.value}
              collateralTokenBalance={collateralTokenBalance?.value}
              ethBalance={ethBalance?.value}
            />
          )}
        </div>
      </div>
    </div>
  );
}
