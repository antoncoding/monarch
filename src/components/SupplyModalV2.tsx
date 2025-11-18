import React, { useState } from 'react';
import { LuArrowRightLeft } from "react-icons/lu";
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { useFreshMarketsState } from '@/hooks/useFreshMarketsState';
import { Market, MarketPosition } from '@/utils/types';
import { MarketDetailsBlock } from './common/MarketDetailsBlock';
import { SupplyModalContent } from './SupplyModalContent';
import { TokenIcon } from './TokenIcon';
import { WithdrawModalContent } from './WithdrawModalContent';
type SupplyModalV2Props = {
  market: Market;
  position?: MarketPosition | null;
  onOpenChange: (open: boolean) => void;
  refetch?: () => void;
  isMarketPage?: boolean;
  defaultMode?: 'supply' | 'withdraw';
};

export function SupplyModalV2({
  market,
  position,
  onOpenChange,
  refetch,
  isMarketPage,
  defaultMode = 'supply',
}: SupplyModalV2Props): JSX.Element {
  const [mode, setMode] = useState<'supply' | 'withdraw'>(defaultMode);
  const [supplyPreviewAmount, setSupplyPreviewAmount] = useState<bigint | undefined>();
  const [withdrawPreviewAmount, setWithdrawPreviewAmount] = useState<bigint | undefined>();

  // Fetch fresh market state from RPC to avoid stale liquidity/supply data
  const { markets: freshMarkets } = useFreshMarketsState([market]);
  const activeMarket = freshMarkets?.[0] ?? market;

  const hasPosition = position && BigInt(position.state.supplyAssets) > 0n;

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      scrollBehavior="inside"
      className="w-full max-w-lg"
    >
      <ModalHeader
        title={`${mode === 'supply' ? 'Supply' : 'Withdraw'} ${activeMarket.loanAsset.symbol}`}
        description={
          mode === 'supply' ? 'Supply to earn interest' : 'Withdraw your supplied assets'
        }
        mainIcon={
          <TokenIcon
            address={activeMarket.loanAsset.address}
            chainId={activeMarket.morphoBlue.chain.id}
            symbol={activeMarket.loanAsset.symbol}
            width={24}
            height={24}
          />
        }
        onClose={() => onOpenChange(false)}
        actions={
          hasPosition ? (
            <button
              type="button"
              onClick={() => setMode(mode === 'supply' ? 'withdraw' : 'supply')}
              className="flex items-center gap-1 text-sm font-medium text-primary transition hover:text-white"
            >
              <LuArrowRightLeft className="h-3 w-3 rotate-90" />
              {mode === 'supply' ? 'Withdraw' : 'Supply'}
            </button>
          ) : undefined
        }
      />
      <ModalBody className="gap-6">
        <MarketDetailsBlock
          market={activeMarket}
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

        {mode === 'supply' ? (
          <SupplyModalContent
            market={activeMarket}
            onClose={() => onOpenChange(false)}
            refetch={refetch ?? (() => {})}
            onAmountChange={setSupplyPreviewAmount}
          />
        ) : (
          <WithdrawModalContent
            position={position}
            market={activeMarket}
            onClose={() => onOpenChange(false)}
            refetch={refetch ?? (() => {})}
            onAmountChange={setWithdrawPreviewAmount}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
