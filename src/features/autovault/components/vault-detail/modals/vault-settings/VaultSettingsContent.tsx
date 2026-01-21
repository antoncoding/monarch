'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Address } from 'viem';
import { slideVariants, slideTransition, type SlideDirection } from '@/components/common/settings-modal';
import type { SupportedNetworks } from '@/utils/networks';
import { VaultSettingsHeader } from './VaultSettingsHeader';
import { GeneralPanel, RolesPanel, CapsPanel } from './panels';
import { EditCapsDetail } from './details';
import type { VaultSettingsCategory, VaultDetailView } from '@/stores/vault-settings-modal-store';

type PanelProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onNavigateToDetail?: (view: Exclude<VaultDetailView, null>) => void;
};

const PANEL_COMPONENTS: Record<VaultSettingsCategory, React.ComponentType<PanelProps>> = {
  general: GeneralPanel,
  roles: RolesPanel,
  caps: CapsPanel,
};

type DetailProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  onBack: () => void;
};

const DETAIL_COMPONENTS: Record<Exclude<VaultDetailView, null>, React.ComponentType<DetailProps>> = {
  'edit-caps': EditCapsDetail,
};

type VaultSettingsContentProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  category: VaultSettingsCategory;
  detailView: VaultDetailView;
  slideDirection: SlideDirection;
  onNavigateToDetail: (view: Exclude<VaultDetailView, null>) => void;
  onBack: () => void;
  onClose: () => void;
};

export function VaultSettingsContent({
  vaultAddress,
  chainId,
  category,
  detailView,
  slideDirection,
  onNavigateToDetail,
  onBack,
  onClose,
}: VaultSettingsContentProps) {
  const PanelComponent = PANEL_COMPONENTS[category];
  const DetailComponent = detailView ? DETAIL_COMPONENTS[detailView] : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <VaultSettingsHeader
        detailView={detailView}
        onBack={onBack}
        onClose={onClose}
      />

      {/* Content area - only animate detail transitions */}
      <div className="relative flex-1 overflow-hidden">
        {DetailComponent ? (
          // Animate only when entering/exiting detail view
          <AnimatePresence
            mode="wait"
            custom={slideDirection}
          >
            <motion.div
              key={detailView}
              custom={slideDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              className="absolute inset-0 overflow-y-auto px-6 py-5"
              style={{ scrollbarGutter: 'stable' }}
            >
              <DetailComponent
                vaultAddress={vaultAddress}
                chainId={chainId}
                onBack={onBack}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          // No animation for category switching - instant display
          <div
            className="absolute inset-0 overflow-y-auto px-6 py-5"
            style={{ scrollbarGutter: 'stable' }}
          >
            <PanelComponent
              vaultAddress={vaultAddress}
              chainId={chainId}
              onNavigateToDetail={onNavigateToDetail}
            />
          </div>
        )}
      </div>
    </div>
  );
}
