'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
} from '@nextui-org/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function RiskNotificationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const hasReadRisks = localStorage.getItem('hasReadRisks');
    if (hasReadRisks !== 'true' && pathname !== '/info/risks') {
      setIsOpen(true);
    }
  }, [pathname]);

  const handleConfirm = () => {
    if (isChecked) {
      localStorage.setItem('hasReadRisks', 'true');
      setIsOpen(false);
    }
  };

  if (pathname === '/info/risks' || pathname === '/' || pathname === '/info') {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={() => {}} hideCloseButton size="3xl" scrollBehavior="inside">
      <ModalContent className="max-h-[90vh] p-4 font-zen sm:p-8">
        <ModalHeader className="flex flex-col gap-1 font-zen text-xl sm:text-2xl">
          Welcome to Monarch
        </ModalHeader>
        <ModalBody className="overflow-auto">
          <p className="mb-4">
            Monarch enables direct lending to the Morpho Blue protocol. Before proceeding, it's
            important to understand the key aspects of this approach. For a comprehensive overview,
            please visit our{' '}
            <Link href="/info" target="_blank" className="text-primary underline">
              introduction page
            </Link>
            .
          </p>
          <p className="mb-2">
            Direct lending through Monarch requires more proactive management compared to using
            vaults. You'll need to regularly rebalance your positions between markets to:
          </p>
          <ul className="mb-4 list-disc pl-6">
            <li>Maintain sufficient liquidity for when you need to withdraw funds</li>
            <li>Adjust your risk exposure in response to changing market conditions</li>
          </ul>

          <p className="mb-4">
            While this approach offers more control, it also requires a deeper understanding of
            market dynamics. For a detailed explanation of the risks and considerations, please read
            our{' '}
            <Link href="/info/risks" target="_blank" className="text-primary underline">
              risk assessment page
            </Link>
            .
          </p>
          <div className="mt-4 rounded border-2 border-dotted border-primary p-4">
            <Checkbox
              isSelected={isChecked}
              onValueChange={setIsChecked}
              className="gap-2"
              size="sm"
            >
              <span className="text-zen text-sm text-secondary">
                I understand that direct lending through Monarch requires active management and have
                read about the associated risks.
              </span>
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
      </ModalContent>
    </Modal>
  );
}
