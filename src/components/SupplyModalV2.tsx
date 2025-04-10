import React, { useState } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { FaArrowRightArrowLeft } from 'react-icons/fa6';
import { useAccount, useBalance } from 'wagmi';
import { Market, MarketPosition } from '@/utils/types';
import { Button } from './common';
import { TokenIcon } from './TokenIcon';
import { SupplyModalContent } from './SupplyModalContent';
import { WithdrawModalContent } from './WithdrawModalContent';

type SupplyModalV2Props = {
  market: Market;
  position?: MarketPosition;
  onClose: () => void;
  refetch?: () => void;
  isMarketPage?: boolean;
};

export function SupplyModalV2({ market, position, onClose, refetch, isMarketPage }: SupplyModalV2Props): JSX.Element {
  const [mode, setMode] = useState<'supply' | 'withdraw'>('supply');
  const { address: account } = useAccount();

  // Get token balance
  const { data: tokenBalance } = useBalance({
    token: market.loanAsset.address as `0x${string}`,
    address: account,
    chainId: market.morphoBlue.chain.id,
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50" style={{ zIndex: 50 }}>
      <div className="bg-surface relative w-full max-w-lg rounded p-6">
        <div className="flex flex-col">
          <button
            type="button"
            className="bg-main absolute right-2 top-2 rounded-full p-1 text-primary hover:cursor-pointer"
            onClick={onClose}
          >
            <Cross1Icon />
          </button>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <TokenIcon
                  address={market.loanAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.loanAsset.symbol}
                  width={20}
                  height={20}
                />
                <span className="text-2xl">{market.loanAsset.symbol}</span>
              </div>
              <span className="mt-1 text-sm text-gray-400">
                {mode === 'supply' ? 'Supply Position' : 'Withdraw Position'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMode(mode === 'supply' ? 'withdraw' : 'supply')}
              className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-white/10"
            >
              <FaArrowRightArrowLeft className="h-3 w-3" />
              {mode === 'supply' ? 'Withdraw' : 'Supply'}
            </button>
          </div>

          {/* Position Overview */}
          <div className="bg-hovered mb-5 rounded p-4">
            <div className="mb-3 font-zen text-base">Position Overview</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 font-zen text-xs opacity-50">Current Supply</p>
                <div className="flex items-center gap-2">
                  <TokenIcon
                    address={market.loanAsset.address}
                    chainId={market.morphoBlue.chain.id}
                    symbol={market.loanAsset.symbol}
                    width={16}
                    height={16}
                  />
                  <p className="font-zen text-sm">
                    {position ? position.state.supplyAssets : '0'} {market.loanAsset.symbol}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 font-zen text-xs opacity-50">Supply APY</p>
                <p className="font-zen text-sm">{(market.state.supplyApy * 100).toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {mode === 'supply' ? (
            <SupplyModalContent
              market={market}
              onClose={onClose}
              isMarketPage={isMarketPage}
            />
          ) : (
            <WithdrawModalContent
              position={position}
              market={market}
              onClose={onClose}
              refetch={refetch ?? (() => {})}
              isMarketPage={isMarketPage}
            />
          )}
        </div>
      </div>
    </div>
  );
} 