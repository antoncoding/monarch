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
          id: 'execute',
          title: 'Confirm Borrow',
          description: 'Confirm transaction in wallet to complete the borrow',
        },
      ];
    }

    if (usePermit2) {
      return [
        {
          id: 'approve_permit2',
          title: 'Authorize Permit2',
          description: `This one-time approval makes sure you don't need to send approval tx again in the future.`,
        },
        {
          id: 'authorize_bundler_sig',
          title: 'Authorize Morpho Bundler (Signature)',
          description: 'Sign a message to authorize the Morpho bundler if needed.',
        },
        {
          id: 'sign_permit',
          title: 'Sign Token Permit',
          description: 'Sign a Permit2 signature to authorize the collateral',
        },
        {
          id: 'execute',
          title: 'Confirm Borrow',
          description: 'Confirm transaction in wallet to complete the borrow',
        },
      ];
    }

    // Standard ERC20 approval flow
    return [
      {
        id: 'authorize_bundler_tx',
        title: 'Authorize Morpho Bundler (Transaction)',
        description: 'Submit a transaction to authorize the Morpho bundler if needed.',
      },
      {
        id: 'approve_token',
        title: `Approve ${tokenSymbol}`,
        description: `Approve ${tokenSymbol} for spending`,
      },
      {
        id: 'execute',
        title: 'Confirm Borrow',
        description: 'Confirm transaction in wallet to complete the borrow',
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
