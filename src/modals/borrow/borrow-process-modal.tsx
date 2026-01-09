import { useMemo } from 'react';
import { FiArrowDownCircle } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { BorrowStepType } from '@/hooks/useBorrowTransaction';
import type { Market } from '@/utils/types';
import { MarketInfoBlock } from '@/features/markets/components/market-info-block';

type MarketBorrow = {
  market: Market;
  collateralAmount: bigint;
  borrowAmount: bigint;
};

type BorrowProcessModalProps = {
  borrow: MarketBorrow;
  currentStep: BorrowStepType;
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  useEth: boolean;
  usePermit2?: boolean;
};

export function BorrowProcessModal({
  borrow,
  currentStep,
  onOpenChange,
  useEth,
  tokenSymbol,
  usePermit2 = true,
}: BorrowProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (useEth) {
      return [
        {
          key: 'execute',
          label: 'Confirm Borrow',
          detail: 'Confirm transaction in wallet to complete the borrow',
        },
      ];
    }

    if (usePermit2) {
      return [
        {
          key: 'approve_permit2',
          label: 'Authorize Permit2',
          detail: `This one-time approval makes sure you don't need to send approval tx again in the future.`,
        },
        {
          key: 'authorize_bundler_sig',
          label: 'Authorize Morpho Bundler (Signature)',
          detail: 'Sign a message to authorize the Morpho bundler if needed.',
        },
        {
          key: 'sign_permit',
          label: 'Sign Token Permit',
          detail: 'Sign a Permit2 signature to authorize the collateral',
        },
        {
          key: 'execute',
          label: 'Confirm Borrow',
          detail: 'Confirm transaction in wallet to complete the borrow',
        },
      ];
    }

    // Standard ERC20 approval flow
    return [
      {
        key: 'authorize_bundler_tx',
        label: 'Authorize Morpho Bundler (Transaction)',
        detail: 'Submit a transaction to authorize the Morpho bundler if needed.',
      },
      {
        key: 'approve_token',
        label: `Approve ${tokenSymbol}`,
        detail: `Approve ${tokenSymbol} for spending`,
      },
      {
        key: 'execute',
        label: 'Confirm Borrow',
        detail: 'Confirm transaction in wallet to complete the borrow',
      },
    ];
  }, [useEth, usePermit2, tokenSymbol]);

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`Borrow ${borrow.market.loanAsset.symbol}`}
        description={`Using ${tokenSymbol} as collateral`}
        mainIcon={<FiArrowDownCircle className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="gap-5">
        <MarketInfoBlock market={borrow.market} />

        <ProcessStepList
          steps={steps}
          currentStep={currentStep}
        />
      </ModalBody>
    </Modal>
  );
}
