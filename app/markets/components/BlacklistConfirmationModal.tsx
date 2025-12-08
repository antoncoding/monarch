'use client';

import { IoWarningOutline } from 'react-icons/io5';
import { Button } from '@/components/common';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { MarketIdentity } from '@/components/MarketIdentity';
import type { Market } from '@/utils/types';

type BlacklistConfirmationModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  market: Market | null;
};

export function BlacklistConfirmationModal({ isOpen, onOpenChange, onConfirm, market }: BlacklistConfirmationModalProps) {
  if (!market) return null;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="md">
      <ModalHeader
        variant="compact"
        mainIcon={<IoWarningOutline className="h-5 w-5 text-orange-500" />}
        title="Blacklist Market"
        description="Confirm removal of this market from your view"
        className="border-b border-primary/10"
        onClose={() => onOpenChange(false)}
      />
      <ModalBody variant="compact" className="py-6">
        <div className="flex flex-col gap-4">
          <div className="bg-hovered rounded p-1">
            <div className="flex flex-col gap-1">
              <MarketIdentity market={market} chainId={market.morphoBlue.chain.id} showId />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded bg-orange-500/10 p-3">
            <IoWarningOutline className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
            <p className="text-xs text-secondary">
              Blacklisted markets will be hidden from all market lists. You can manage and remove blacklisted markets later in Settings.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter className="border-t border-primary/10">
        <Button variant="secondary" size="md" onPress={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="cta" size="md" onPress={handleConfirm}>
          Blacklist Market
        </Button>
      </ModalFooter>
    </Modal>
  );
}
