import Image from 'next/image';
import { MdWarning } from 'react-icons/md';
import { Modal, ModalHeader, ModalBody } from '@/components/common/Modal';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';

type RedstoneTypesModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function RedstoneTypesModal({ isOpen, onClose }: RedstoneTypesModalProps) {
  const redstoneIcon = OracleVendorIcons[PriceFeedVendors.Redstone];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      zIndex="base"
      size="xl"
    >
      <ModalHeader
        title="Redstone Feed Types"
        description="Understanding market and fundamental price feeds"
        mainIcon={redstoneIcon ? <Image src={redstoneIcon} alt="Redstone" width={20} height={20} /> : undefined}
        onClose={onClose}
      />

      <ModalBody>
        <div className="space-y-5">
          {/* Market Feed (Standard) */}
          <div className="rounded-sm bg-hovered p-4">
            <h3 className="text-base text-primary">Market Feed (Standard)</h3>
            <p className="mt-2 text-sm text-secondary">
              Tracks market trading prices denominated in USD or major currencies (e.g., BTC/USD,
              ETH/BTC). Reflects real-time market movements with simple aggregation across
              exchanges.
            </p>
          </div>

          {/* Fundamental Feed */}
          <div className="rounded-sm bg-hovered p-4">
            <h3 className="text-base text-primary">Fundamental Feed (Contract Rate)</h3>
            <p className="mt-2 text-sm text-secondary">
              Tracks the on-chain exchange rate between an underlying asset and its derivative from
              protocol smart contracts, offering less volatile pricing but introducing additional
              trust assumptions about the protocol&apos;s structure and reserve liquidity.
            </p>
            <p className="mt-2 text-xs text-secondary">
              Examples: wstETH/stETH from Lido, weETH/eETH from Ether.fi
            </p>

            {/* Warning Box */}
            <div className="mt-3 flex items-center rounded-sm bg-yellow-200 p-4 text-yellow-700 opacity-80">
              <MdWarning className="mr-2 flex-shrink-0" size={18} />
              <div>
                <h4 className="text-xs font-bold">Trust Assumptions</h4>
                <p className="text-xs">
                  Relies on protocol smart contract structure and underlying reserve liquidity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
