import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { FEED_TYPE_INFO, FeedTypeBadge } from './FeedTypeBadge';

type FeedTypesModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function FeedTypesModal({ isOpen, onClose }: FeedTypesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      zIndex="base"
      size="xl"
    >
      <ModalHeader
        title="Feed Types"
        description="Scanner categories for how each oracle feed derives its price"
        onClose={onClose}
      />

      <ModalBody>
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Feed type is separate from provider. A Chainlink, Compound, Redstone, Pendle, or other provider feed can still belong to a
            different pricing category.
          </p>

          <div className="space-y-3">
            {Object.entries(FEED_TYPE_INFO).map(([feedType, info]) => (
              <div
                key={feedType}
                className="rounded-sm bg-hovered p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FeedTypeBadge feedType={feedType} />
                    <h3 className="text-sm font-medium text-primary">{info.label} Feed</h3>
                  </div>
                  <Link
                    href={info.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Read ${info.label} feed docs`}
                    className="rounded-sm p-1 text-secondary transition-colors hover:bg-main hover:text-primary"
                  >
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="mt-2 text-sm text-secondary">{info.description}</p>
              </div>
            ))}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
