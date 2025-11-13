import React, { useState } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { FaArrowRightArrowLeft } from 'react-icons/fa6';
import { useAccount, useBalance } from 'wagmi';
import { Market, MarketPosition } from '@/utils/types';
import { AddCollateralAndBorrow } from './Borrow/AddCollateralAndBorrow';
import { WithdrawCollateralAndRepay } from './Borrow/WithdrawCollateralAndRepay';
import { TokenIcon } from './TokenIcon';

type BorrowModalProps = {
  market: Market;
  onClose: () => void;
  oraclePrice: bigint;
  refetch?: () => void;
  isRefreshing?: boolean;
  position: MarketPosition | null;
};

export function BorrowModal({
  market,
  onClose,
  oraclePrice,
  refetch,
  isRefreshing = false,
  position,
}: BorrowModalProps): JSX.Element {
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

  const hasPosition =
    position &&
    (BigInt(position.state.borrowAssets) > 0n || BigInt(position.state.collateral) > 0n);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 font-zen"
      style={{ zIndex: 50 }}
    >
      <div className="bg-surface relative w-full max-w-lg rounded-lg p-6">
        <div className="flex flex-col">
          <button
            type="button"
            className="absolute right-2 top-2 text-secondary opacity-60 transition-opacity hover:opacity-100"
            onClick={onClose}
          >
            <Cross1Icon />
          </button>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
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
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{market.loanAsset.symbol}</span>
                    <span className="text-xs opacity-50">/ {market.collateralAsset.symbol}</span>
                  </div>
                  <span className="mt-1 text-sm opacity-50">
                    {mode === 'borrow' ? 'Borrow against collateral' : 'Repay borrowed assets'}
                  </span>
                </div>
              </div>
            </div>

            {hasPosition && (
              <button
                type="button"
                onClick={() => setMode(mode === 'borrow' ? 'repay' : 'borrow')}
                className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-white/10"
              >
                <FaArrowRightArrowLeft className="h-3 w-3" />
                {mode === 'borrow' ? 'Repay' : 'Borrow'}
              </button>
            )}
          </div>

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
        </div>
      </div>
    </div>
  );
}
