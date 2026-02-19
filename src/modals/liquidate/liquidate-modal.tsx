import { useReadContract } from 'wagmi';
import { Modal, ModalHeader, ModalBody } from '@/components/common/Modal';
import type { Market } from '@/utils/types';
import { LiquidateModalContent } from './components/liquidate-modal-content';
import { TokenIcon } from '@/components/shared/token-icon';
import type { Address } from 'viem';

type LiquidateModalProps = {
  market: Market;
  borrower: Address;
  onOpenChange: (open: boolean) => void;
};

export function LiquidateModal({ market, borrower, onOpenChange }: LiquidateModalProps): JSX.Element {
  const { data: borrowerPosition } = useReadContract({
    address: market.morphoBlue.address as `0x${string}`,
    functionName: 'position',
    args: [borrower, market.uniqueKey as `0x${string}`],
    abi: [
      {
        inputs: [
          { internalType: 'address', name: 'user', type: 'address' },
          { internalType: 'Id', name: 'id', type: 'bytes32' },
        ],
        name: 'position',
        outputs: [
          { internalType: 'uint256', name: 'supplyShares', type: 'uint256' },
          { internalType: 'uint256', name: 'borrowShares', type: 'uint256' },
          { internalType: 'uint256', name: 'collateral', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!borrower,
    },
  });

  const borrowerCollateral = borrowerPosition ? BigInt(borrowerPosition[2]) : 0n;
  const borrowerDebt = borrowerPosition ? BigInt(borrowerPosition[1]) : 0n;

  const mainIcon = (
    <div className="flex -space-x-2">
      <TokenIcon
        address={market.loanAsset.address}
        chainId={market.morphoBlue.chain.id}
        symbol={market.loanAsset.symbol}
        width={24}
        height={24}
      />
      <div className="rounded-full border border-gray-800">
        <TokenIcon
          address={market.collateralAsset.address}
          chainId={market.morphoBlue.chain.id}
          symbol={market.collateralAsset.symbol}
          width={24}
          height={24}
        />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
    >
      <ModalHeader
        mainIcon={mainIcon}
        onClose={() => onOpenChange(false)}
        title={
          <div className="flex items-center gap-2">
            <span>{market.loanAsset.symbol}</span>
            <span className="text-xs opacity-50">/ {market.collateralAsset.symbol}</span>
          </div>
        }
        description="Liquidate a underwater position"
      />
      <ModalBody>
        <LiquidateModalContent
          market={market}
          borrower={borrower}
          borrowerCollateral={borrowerCollateral}
          borrowerDebt={borrowerDebt}
          onSuccess={() => onOpenChange(false)}
        />
      </ModalBody>
    </Modal>
  );
}
