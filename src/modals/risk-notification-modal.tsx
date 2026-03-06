'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
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
        title="Monarch Risk Notice"
        description="Important information before you interact with markets"
        mainIcon={<PiButterflyDuotone className="h-6 w-6 text-primary" />}
        onClose={() => setIsOpen(false)}
      />
      <ModalBody className="overflow-auto">
        <p className="mb-4">
          Monarch helps you inspect and interact with up-to-date Morpho markets across lending and borrowing workflows.
        </p>
        <p className="mb-2">With direct market access, you can:</p>
        <ul className="mb-4 ml-6 list-disc">
          <li>Compare market conditions and choose where to supply, borrow, or adjust positions</li>
          <li>Manage exposure across collateral types, liquidity conditions, and rate environments</li>
          <li>Rebalance or unwind positions as market conditions change</li>
        </ul>

        <p className="mb-4">
          This flexibility comes with responsibility. Please do your own due diligence on each market (for example LLTV, oracle setup,
          liquidity depth, and collateral behavior), and actively monitor your positions over time.
        </p>
        <Checkbox
          variant="highlighted"
          label="I understand that using Monarch requires due diligence and active position management"
          checked={isChecked}
          onCheckedChange={(checked) => setIsChecked(checked === true)}
        />
      </ModalBody>
      <ModalFooter>
        <Button
          className="bg-monarch-orange text-white"
          onClick={handleConfirm}
          disabled={!isChecked}
        >
          Confirm and Proceed
        </Button>
      </ModalFooter>
    </Modal>
  );
}
