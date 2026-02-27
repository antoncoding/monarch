import { useEffect, useMemo, useState } from 'react';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
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
  const effectiveMode = mode === 'withdraw' && !hasPosition ? 'supply' : mode;
  const modeOptions = useMemo(
    () =>
      hasPosition
        ? [
            { value: 'supply', label: `Supply ${activeMarket.loanAsset.symbol}` },
            { value: 'withdraw', label: `Withdraw ${activeMarket.loanAsset.symbol}` },
          ]
        : [{ value: 'supply', label: `Supply ${activeMarket.loanAsset.symbol}` }],
    [activeMarket.loanAsset.symbol, hasPosition],
  );

  useEffect(() => {
    if (mode === 'withdraw' && !hasPosition) {
      setMode('supply');
    }
  }, [mode, hasPosition]);

  // Calculate supply delta for preview based on current mode and amounts
  // Only use positive values to prevent incorrect APY direction
  const supplyDelta = useMemo(() => {
    if (effectiveMode === 'supply') {
      // Supply mode: positive delta if amount is valid
      return supplyPreviewAmount && supplyPreviewAmount > 0n ? supplyPreviewAmount : undefined;
    }
    // Withdraw mode: negative delta (withdrawal) if amount is valid
    return withdrawPreviewAmount && withdrawPreviewAmount > 0n ? -withdrawPreviewAmount : undefined;
  }, [effectiveMode, supplyPreviewAmount, withdrawPreviewAmount]);

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      scrollBehavior="inside"
      className="w-full max-w-lg"
    >
      <ModalHeader
        title={
          <ModalIntentSwitcher
            value={effectiveMode}
            options={modeOptions}
            onValueChange={(nextMode) => {
              setMode(nextMode as 'supply' | 'withdraw');
              setSupplyPreviewAmount(undefined);
              setWithdrawPreviewAmount(undefined);
            }}
          />
        }
        description={
          effectiveMode === 'supply'
            ? `Supply ${activeMarket.loanAsset.symbol} to earn interest in this market.`
            : `Withdraw your supplied ${activeMarket.loanAsset.symbol} from this market.`
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
      />
      <ModalBody className="gap-6">
        <MarketDetailsBlock
          market={activeMarket}
          showDetailsLink={!isMarketPage}
          defaultCollapsed
          mode="supply"
          showRewards
          supplyDelta={supplyDelta}
          extraLiquidity={effectiveMode === 'withdraw' ? liquiditySourcing?.totalAvailableExtraLiquidity : undefined}
        />

        {effectiveMode === 'supply' ? (
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
