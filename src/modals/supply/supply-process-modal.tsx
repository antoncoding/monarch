import { useMemo } from 'react';
import { FiUpload } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { Market } from '@/utils/types';
import { MarketInfoBlock } from '@/features/markets/components/market-info-block';

type MarketSupply = {
  market: Market;
  amount: bigint;
};

type SupplyProcessModalProps = {
  supplies: MarketSupply[];
  currentStep: 'approve' | 'signing' | 'supplying';
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  useEth: boolean;
  usePermit2?: boolean;
};

export function SupplyProcessModal({
  supplies,
  currentStep,
  onOpenChange,
  useEth,
  tokenSymbol,
  usePermit2 = true,
}: SupplyProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (useEth) {
      return [
        {
          id: 'supplying',
          title: 'Confirm Supply',
          description: 'Confirm transaction in wallet to complete the supply',
        },
      ];
    }

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
          description: 'Sign a Permit2 signature to authorize the supply',
        },
        {
          id: 'supplying',
          title: 'Confirm Supply',
          description: 'Confirm transaction in wallet to complete the supply',
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
        id: 'supplying',
        title: 'Confirm Supply',
        description: 'Confirm transaction in wallet to complete the supply',
      },
    ];
  }, [useEth, usePermit2, tokenSymbol]);

  const isMultiMarket = supplies.length > 1;

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`Supply ${tokenSymbol}`}
        description={isMultiMarket ? `Supplying to ${supplies.length} markets` : 'Supplying to market'}
        mainIcon={<FiUpload className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="gap-5">
        <div className="flex flex-col gap-3">
          {supplies.map((supply) => (
            <MarketInfoBlock
              market={supply.market}
              amount={supply.amount}
              key={supply.market.uniqueKey}
            />
          ))}
        </div>

        <ProcessStepList
          steps={steps}
          currentStep={currentStep}
        />
      </ModalBody>
    </Modal>
  );
}
