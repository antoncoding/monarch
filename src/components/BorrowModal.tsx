import React, { useState } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useAccount, useBalance } from 'wagmi';
import useUserPosition from '@/hooks/useUserPosition';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { AddCollateralAndBorrow } from './Borrow/AddCollateralAndBorrow';

type BorrowModalProps = {
  market: Market;
  onClose: () => void;
};

export function BorrowModal({ market, onClose }: BorrowModalProps): JSX.Element {
  
  const [mode, setMode] = useState<'borrow' | 'repay'>('borrow');
  
  const { address: account} = useAccount();

  // Get user positions to calculate current LTV
  const { position: currentPosition, refetch: refetchPosition } = useUserPosition(
    account,
    market.morphoBlue.chain.id,
    market.uniqueKey,
  );

  // Find tokens
  const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);
  const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);

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
              <Cross1Icon />{' '}
            </button>

            <div className="mb-2 flex items-center gap-2 py-2 text-2xl">
              {loanToken?.img && (
                <Image src={loanToken.img} height={24} width={24} alt={loanToken.symbol} />
              )}
              {loanToken ? loanToken.symbol : market.loanAsset.symbol} Position
            </div>

            <AddCollateralAndBorrow
              market={market}
              currentPosition={currentPosition}
              refetchPosition={refetchPosition}
              loanToken={loanToken}
              collateralToken={collateralToken}
              loanTokenBalance={loanTokenBalance?.value}
              collateralTokenBalance={collateralTokenBalance?.value}
              ethBalance={ethBalance?.value}
            />
          </div>
      </div>
    </div>
  );
}
