import React, { useState } from 'react';
import { LuArrowRightLeft } from "react-icons/lu";
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
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
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      className="w-full max-w-lg"
    >
      <ModalHeader
        title={`${mode === 'supply' ? 'Supply' : 'Withdraw'} ${market.loanAsset.symbol}`}
        description={
          mode === 'supply' ? 'Supply to earn interest' : 'Withdraw your supplied assets'
        }
        mainIcon={
          <TokenIcon
            address={market.loanAsset.address}
            chainId={market.morphoBlue.chain.id}
            symbol={market.loanAsset.symbol}
            width={24}
            height={24}
          />
        }
        onClose={onClose}
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
      </ModalBody>
    </Modal>
  );
}
