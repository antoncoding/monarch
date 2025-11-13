'use client';

import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { IoWarningOutline } from 'react-icons/io5';
import { Button } from '@/components/common';
import { MarketIdentity } from '@/components/MarketIdentity';
import { Market } from '@/utils/types';

type BlacklistConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  market: Market | null;
};

export function BlacklistConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  market,
}: BlacklistConfirmationModalProps) {
  if (!market) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onClose}
      size="md"
      classNames={{
        base: 'bg-surface rounded',
        header: 'border-b border-primary/10',
        body: 'py-6',
        footer: 'border-t border-primary/10',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 font-zen text-primary">
          <IoWarningOutline className="h-5 w-5 text-orange-500" />
          <span>Blacklist Market</span>
        </ModalHeader>
        <ModalBody className="font-zen">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-primary">
              Are you sure you want to blacklist this market?
            </p>

            <div className="bg-hovered rounded p-1">
              <div className="flex flex-col gap-1">
                <MarketIdentity market={market} chainId={market.morphoBlue.chain.id} showId/>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded bg-orange-500/10 p-3">
              <IoWarningOutline className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
              <p className="text-xs text-secondary">
                Blacklisted markets will be hidden from all market lists. You can manage and remove
                blacklisted markets later in Settings.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" size="md" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="cta" size="md" onPress={handleConfirm}>
            Blacklist Market
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
