'use client';

import { useState, useEffect } from 'react';
import { Button, Checkbox } from '@heroui/react';
import { usePathname } from 'next/navigation';
import { PiButterflyDuotone } from 'react-icons/pi';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';

export default function RiskNotificationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const hasReadRisks = localStorage.getItem('hasReadRisks');
    if (hasReadRisks !== 'true' && pathname !== '/') {
      setIsOpen(true);
    }
  }, [pathname]);

  const handleConfirm = () => {
    if (isChecked) {
      localStorage.setItem('hasReadRisks', 'true');
      setIsOpen(false);
    }
  };

  if (pathname === '/') {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      size="3xl"
      scrollBehavior="inside"
      className="max-h-[90vh]"
    >
      <ModalHeader
        title="Welcome to Monarch"
        description="Important information before you begin"
        mainIcon={<PiButterflyDuotone className="h-6 w-6 text-primary" />}
        onClose={() => setIsOpen(false)}
      />
      <ModalBody className="overflow-auto">
        <p className="mb-4">
          Monarch enables direct lending to Morpho Blue markets, giving you maximum flexibility and control over your lending positions.
        </p>
        <p className="mb-2">With direct lending, you have the freedom to:</p>
        <ul className="mb-4 ml-6 list-disc">
          <li>Choose exactly which markets to lend to based on your risk preferences</li>
          <li>Rebalance positions between markets to optimize yields and liquidity</li>
          <li>Customize your exposure to different collateral types and risk parameters</li>
        </ul>

        <p className="mb-4">
          This flexibility comes with the responsibility to actively manage your positions, monitor market conditions, and make informed
          decisions about rebalancing.
        </p>
        <div className="mt-4">
          <Checkbox
            isSelected={isChecked}
            onValueChange={setIsChecked}
            className="gap-2"
            size="sm"
          >
            <span className="text-zen text-sm text-secondary">I understand that direct lending requires active management</span>
          </Checkbox>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          className="bg-monarch-orange text-white"
          onPress={handleConfirm}
          isDisabled={!isChecked}
        >
          Confirm and Proceed
        </Button>
      </ModalFooter>
    </Modal>
  );
}
