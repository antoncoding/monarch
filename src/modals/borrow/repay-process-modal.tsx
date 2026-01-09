import { useMemo } from 'react';
import { FiRepeat } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { Market } from '@/utils/types';
import { MarketInfoBlock } from '@/features/markets/components/market-info-block';

type RepayProcessModalProps = {
  market: Market;
  repayAmount: bigint;
  withdrawAmount: bigint;
  currentStep: 'approve' | 'signing' | 'repaying';
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  usePermit2?: boolean;
};

export function RepayProcessModal({
  market,
  repayAmount,
  withdrawAmount,
  currentStep,
  onOpenChange,
  tokenSymbol,
  usePermit2 = true,
}: RepayProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (usePermit2) {
      return [
        {
          id: 'approve',
          title: 'Authorize Permit2',
          description: `This one-time approval makes sure you don't need to send approval tx again in the future.`,
        },
        {
          id: 'signing',
          title: 'Sign message in wallet',
          description: 'Sign a Permit2 signature to authorize the repayment',
        },
        {
          id: 'repaying',
          title: 'Confirm Repay',
          description: 'Confirm transaction in wallet to complete the repayment',
        },
      ];
    }

    // Standard ERC20 approval flow
    return [
      {
        id: 'approve',
        title: 'Approve Token',
        description: `Approve ${tokenSymbol} for spending`,
      },
      {
        id: 'repaying',
        title: 'Confirm Repay',
        description: 'Confirm transaction in wallet to complete the repayment',
      },
    ];
  }, [usePermit2, tokenSymbol]);

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`${withdrawAmount > 0n ? 'Withdraw & Repay' : 'Repay'} ${tokenSymbol}`}
        description={withdrawAmount > 0n ? 'Withdrawing collateral and repaying loan' : 'Repaying loan to market'}
        mainIcon={<FiRepeat className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="gap-5">
        <MarketInfoBlock
          market={market}
          amount={repayAmount}
        />

        <ProcessStepList
          steps={steps}
          currentStep={currentStep}
        />
      </ModalBody>
    </Modal>
  );
}
