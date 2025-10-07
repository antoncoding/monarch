import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { VaultRole } from './VaultRolesOverview';
import { VaultRolesOverview } from './VaultRolesOverview';

type VaultRolesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roles: VaultRole[];
};

export function VaultRolesModal({ isOpen, onClose, roles }: VaultRolesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-background dark:border border-gray-700',
        wrapper: 'z-50',
        backdrop: 'z-[45] bg-black/60',
      }}
    >
      <ModalContent>
        <ModalHeader className="font-zen text-xl font-semibold">Vault roles & safeguards</ModalHeader>
        <ModalBody className="pb-6">
          <VaultRolesOverview roles={roles} />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
