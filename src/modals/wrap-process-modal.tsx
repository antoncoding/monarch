import { LuArrowRightLeft } from 'react-icons/lu';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { WrapStep } from '@/hooks/useWrapLegacyMorpho';

const WRAP_STEPS = [
  {
    key: 'approve',
    label: 'Approve Wrapper',
    detail: 'Approve the wrapper contract to spend your legacy MORPHO tokens',
  },
  {
    key: 'wrap',
    label: 'Wrap MORPHO',
    detail: 'Confirm transaction to wrap your legacy MORPHO tokens',
  },
];

type WrapProcessModalProps = {
  currentStep: WrapStep;
  onOpenChange: (opened: boolean) => void;
};

export function WrapProcessModal({ currentStep, onOpenChange }: WrapProcessModalProps): JSX.Element {
  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title="Wrapping MORPHO"
        description="Track each step to move legacy MORPHO into the new token"
        mainIcon={<LuArrowRightLeft className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="gap-5">
        <ProcessStepList
          steps={WRAP_STEPS}
          currentStep={currentStep}
        />
      </ModalBody>
    </Modal>
  );
}
