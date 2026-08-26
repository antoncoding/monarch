import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { FEED_MECHANISM_INFO, type FeedMechanismKind } from '@/utils/oracle';
import { FeedMechanismBadge } from './FeedMechanismBadge';
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
        description="How a feed is classified and how its price is produced"
        onClose={onClose}
      />

      <ModalBody>
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Provider identifies who publishes a feed. Type and mechanism describe what it reports and how the price is produced.
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

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium text-primary">Pricing mechanisms</h3>
          </div>

          <div className="divide-y divide-border rounded-sm border border-border">
            {Object.entries(FEED_MECHANISM_INFO).map(([mechanism, info]) => (
              <div
                key={mechanism}
                className="grid gap-2 p-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start"
              >
                <div className="flex items-center gap-2">
                  <FeedMechanismBadge mechanism={mechanism as FeedMechanismKind} />
                  <span className="text-xs text-secondary sm:hidden">{info.label}</span>
                </div>
                <div>
                  <h4 className="hidden text-sm font-medium text-primary sm:block">{info.label}</h4>
                  <p className="text-sm text-secondary sm:mt-1">{info.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
