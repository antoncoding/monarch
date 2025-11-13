import React, { useState } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { FaArrowRightArrowLeft } from 'react-icons/fa6';
import { Market, MarketPosition } from '@/utils/types';
import { MarketDetailsBlock } from './common/MarketDetailsBlock';
import { SupplyModalContent } from './SupplyModalContent';
import { TokenIcon } from './TokenIcon';
import { WithdrawModalContent } from './WithdrawModalContent';
type SupplyModalV2Props = {
  market: Market;
  position?: MarketPosition | null;
  onClose: () => void;
  refetch?: () => void;
  isMarketPage?: boolean;
  defaultMode?: 'supply' | 'withdraw';
};

export function SupplyModalV2({
  market,
  position,
  onClose,
  refetch,
  isMarketPage,
  defaultMode = 'supply',
}: SupplyModalV2Props): JSX.Element {
  const [mode, setMode] = useState<'supply' | 'withdraw'>(defaultMode);
  const [supplyPreviewAmount, setSupplyPreviewAmount] = useState<bigint | undefined>();
  const [withdrawPreviewAmount, setWithdrawPreviewAmount] = useState<bigint | undefined>();

  const hasPosition = position && BigInt(position.state.supplyAssets) > 0n;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 font-zen"
      style={{ zIndex: 50 }}
    >
      <div className="bg-surface relative w-full max-w-lg rounded p-6">
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
                <TokenIcon
                  address={market.loanAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.loanAsset.symbol}
                  width={20}
                  height={20}
                />
                <span className="text-2xl">
                  {mode === 'supply' ? 'Supply' : 'Withdraw'} {market.loanAsset.symbol}
                </span>
              </div>
              <span className="mt-1 text-sm text-gray-400">
                {mode === 'supply' ? 'Supply to earn interest' : 'Withdraw your supplied assets'}
              </span>
            </div>

            {hasPosition && (
              <button
                type="button"
                onClick={() => setMode(mode === 'supply' ? 'withdraw' : 'supply')}
                className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-white/10"
              >
                <FaArrowRightArrowLeft className="h-3 w-3 rotate-90" />
                {mode === 'supply' ? 'Withdraw' : 'Supply'}
              </button>
            )}
          </div>

          {/* Market Details Block - includes position overview and collapsible details */}
          <div className="mb-5">
            <MarketDetailsBlock
              market={market}
              showDetailsLink={!isMarketPage}
              defaultCollapsed
              mode="supply"
              showRewards
              supplyDelta={
                mode === 'supply'
                  ? supplyPreviewAmount
                  : withdrawPreviewAmount
                  ? -withdrawPreviewAmount
                  : undefined
              }
            />
          </div>

          {mode === 'supply' ? (
            <SupplyModalContent
              market={market}
              onClose={onClose}
              refetch={refetch ?? (() => {})}
              onAmountChange={setSupplyPreviewAmount}
            />
          ) : (
            <WithdrawModalContent
              position={position}
              market={market}
              onClose={onClose}
              refetch={refetch ?? (() => {})}
              onAmountChange={setWithdrawPreviewAmount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
