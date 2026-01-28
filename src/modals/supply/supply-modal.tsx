import { useEffect, useMemo, useState } from 'react';
import { LuArrowRightLeft } from 'react-icons/lu';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { useFreshMarketsState } from '@/hooks/useFreshMarketsState';
import type { Market, MarketPosition } from '@/utils/types';
import type { LiquiditySourcingResult } from '@/hooks/useMarketLiquiditySourcing';
import { MarketDetailsBlock } from '@/features/markets/components/market-details-block';
import { SupplyModalContent } from './supply-modal-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { WithdrawModalContent } from './withdraw-modal-content';
type SupplyModalV2Props = {
  market: Market;
  position?: MarketPosition | null;
  onOpenChange: (open: boolean) => void;
  refetch?: () => void;
  isMarketPage?: boolean;
  defaultMode?: 'supply' | 'withdraw';
  liquiditySourcing?: LiquiditySourcingResult;
};

export function SupplyModalV2({
  market,
  position,
  onOpenChange,
  refetch,
  isMarketPage,
  defaultMode = 'supply',
  liquiditySourcing,
}: SupplyModalV2Props): JSX.Element {
  const [mode, setMode] = useState<'supply' | 'withdraw'>(defaultMode);
  const [supplyPreviewAmount, setSupplyPreviewAmount] = useState<bigint | undefined>();
  const [withdrawPreviewAmount, setWithdrawPreviewAmount] = useState<bigint | undefined>();

  // Reset preview amounts and mode when modal is first opened to prevent stale state
  useEffect(() => {
    setMode(defaultMode);
    setSupplyPreviewAmount(undefined);
    setWithdrawPreviewAmount(undefined);
  }, [defaultMode]);

  // Fetch fresh market state from RPC to avoid stale liquidity/supply data
  const { markets: freshMarkets } = useFreshMarketsState([market]);
  const activeMarket = freshMarkets?.[0] ?? market;

  const hasPosition = position && BigInt(position.state.supplyAssets) > 0n;

  // Calculate supply delta for preview based on current mode and amounts
  // Only use positive values to prevent incorrect APY direction
  const supplyDelta = useMemo(() => {
    if (mode === 'supply') {
      // Supply mode: positive delta if amount is valid
      return supplyPreviewAmount && supplyPreviewAmount > 0n ? supplyPreviewAmount : undefined;
    }
    // Withdraw mode: negative delta (withdrawal) if amount is valid
    return withdrawPreviewAmount && withdrawPreviewAmount > 0n ? -withdrawPreviewAmount : undefined;
  }, [mode, supplyPreviewAmount, withdrawPreviewAmount]);

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
        description={mode === 'supply' ? 'Supply to earn interest' : 'Withdraw your supplied assets'}
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
              onClick={() => {
                const newMode = mode === 'supply' ? 'withdraw' : 'supply';
                setMode(newMode);
                // Reset preview amounts when switching modes to prevent stale state
                setSupplyPreviewAmount(undefined);
                setWithdrawPreviewAmount(undefined);
              }}
              className="flex items-center gap-1 text-sm font-medium text-primary transition hover:text-secondary"
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
          supplyDelta={supplyDelta}
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
            liquiditySourcing={liquiditySourcing}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
