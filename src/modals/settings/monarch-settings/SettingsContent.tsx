'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { SettingsHeader } from './SettingsHeader';
import { TransactionPanel, DisplayPanel, FiltersPanel, PreferencesPanel, ExperimentalPanel } from './panels';
import { TrendingDetail, TrustedVaultsDetail, BlacklistedMarketsDetail, RpcDetail, ThresholdsDetail } from './details';
import type { SettingsCategory, DetailView } from './constants';

type PanelProps = {
  onNavigateToDetail?: (view: DetailView) => void;
};

const PANEL_COMPONENTS: Record<SettingsCategory, React.ComponentType<PanelProps>> = {
  transaction: TransactionPanel,
  display: DisplayPanel,
  filters: FiltersPanel,
  preferences: PreferencesPanel,
  experimental: ExperimentalPanel,
};

const DETAIL_COMPONENTS: Record<Exclude<DetailView, null>, React.ComponentType> = {
  'trending-config': TrendingDetail,
  'trusted-vaults': TrustedVaultsDetail,
  'blacklisted-markets': BlacklistedMarketsDetail,
  'rpc-config': RpcDetail,
  'filter-thresholds': ThresholdsDetail,
};

const slideVariants = {
  enter: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? '100%' : '-30%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? '-30%' : '100%',
    opacity: 0,
  }),
};

type SettingsContentProps = {
  category: SettingsCategory;
  detailView: DetailView;
  slideDirection: 'forward' | 'backward';
  onNavigateToDetail: (view: DetailView) => void;
  onBack: () => void;
  onClose: () => void;
};

export function SettingsContent({ category, detailView, slideDirection, onNavigateToDetail, onBack, onClose }: SettingsContentProps) {
  const PanelComponent = PANEL_COMPONENTS[category];
  const DetailComponent = detailView ? DETAIL_COMPONENTS[detailView] : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SettingsHeader
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
              transition={{
                type: 'tween',
                duration: 0.15,
                ease: 'easeOut',
              }}
              className="absolute inset-0 overflow-y-auto px-6 py-5"
              style={{ scrollbarGutter: 'stable' }}
            >
              <DetailComponent />
            </motion.div>
          </AnimatePresence>
        ) : (
          // No animation for category switching - instant display
          <div
            className="absolute inset-0 overflow-y-auto px-6 py-5"
            style={{ scrollbarGutter: 'stable' }}
          >
            <PanelComponent onNavigateToDetail={onNavigateToDetail} />
          </div>
        )}
      </div>
    </div>
  );
}
