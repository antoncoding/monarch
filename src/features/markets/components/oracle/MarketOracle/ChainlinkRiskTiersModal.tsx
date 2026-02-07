import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalHeader, ModalBody } from '@/components/common/Modal';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';

type ChainlinkRiskTiersModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ChainlinkRiskTiersModal({ isOpen, onClose }: ChainlinkRiskTiersModalProps) {
  const chainlinkIcon = OracleVendorIcons[PriceFeedVendors.Chainlink];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      zIndex="base"
      size="xl"
    >
      <ModalHeader
        title="Chainlink Risk Tier Categories"
        description="Risk categories assigned by Chainlink for data feeds"
        mainIcon={
          chainlinkIcon ? (
            <Image
              src={chainlinkIcon}
              alt="Chainlink"
              width={20}
              height={20}
            />
          ) : undefined
        }
        onClose={onClose}
      />

      <ModalBody>
        <div className="space-y-4">
          {/* Low Risk */}
          <div className="rounded-sm bg-hovered p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant="success"
                size="sm"
              >
                LOW RISK
              </Badge>
            </div>
            <p className="text-sm text-secondary">
              Data feeds following standardized workflows to report market prices. Highly resilient to disruption with many data sources.
              High trading volumes across large numbers of markets enable consistent price discovery.
            </p>
          </div>

          {/* Medium Risk */}
          <div className="rounded-sm bg-hovered p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant="warning"
                size="sm"
              >
                MEDIUM RISK
              </Badge>
            </div>
            <p className="text-sm text-secondary">
              Market price feeds for asset pairs that may have features making them more challenging to reliably price or subject to
              volatility. Risk factors include lower or inconsistent volume, spread between trading venues, market concentration on single
              exchanges, cross-rate pricing, or significant market events.
            </p>
          </div>

          {/* High Risk */}
          <div className="rounded-sm bg-hovered p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant="danger"
                size="sm"
              >
                HIGH RISK
              </Badge>
            </div>
            <p className="text-sm text-secondary">
              Asset pairs exhibiting heightened risk factors that make market prices subject to uncertainty or volatility. Risk factors
              include significant market events (hacks, bridge failures, major exchange delistings), asset or project deprecation, or
              extremely low trading volumes.
            </p>
          </div>

          {/* Custom */}
          <div className="rounded-sm bg-hovered p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge
                variant="primary"
                size="sm"
              >
                CUSTOM
              </Badge>
            </div>
            <p className="text-sm text-secondary">
              Feeds built to serve specific use cases and may not be suitable for general use. Categories include onchain single source
              feeds, proof of reserve feeds, exchange rate feeds, technical metric feeds, total value locked feeds, custom index feeds, and
              LP token feeds. Users must evaluate feed properties against their intended use case.
            </p>
          </div>

          <p className="text-xs text-secondary italic">
            Risk tier categories are assigned by Chainlink based on feed characteristics and market conditions.
          </p>
        </div>
      </ModalBody>
    </Modal>
  );
}
