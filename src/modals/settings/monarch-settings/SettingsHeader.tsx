'use client';

import { SettingsHeader as SharedSettingsHeader } from '@/components/common/settings-modal';
import { DETAIL_TITLES, type DetailView } from './constants';

type SettingsHeaderProps = {
  detailView: DetailView;
  onBack: () => void;
  onClose: () => void;
};

export function SettingsHeader({ detailView, onBack, onClose }: SettingsHeaderProps) {
  const title = detailView ? DETAIL_TITLES[detailView] : 'Settings';

  return (
    <SharedSettingsHeader
      title={title}
      showBack={!!detailView}
      onBack={onBack}
      onClose={onClose}
    />
  );
}
