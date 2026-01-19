'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { DETAIL_TITLES, type DetailView, type SettingsCategory } from './constants';
import { SettingsContent } from './SettingsContent';
import { SettingsSidebar } from './SettingsSidebar';

type MonarchSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory?: SettingsCategory;
  initialDetailView?: DetailView;
  onCloseCallback?: () => void;
};

export function MonarchSettingsModal({
  isOpen,
  onOpenChange,
  initialCategory = 'transaction',
  initialDetailView,
  onCloseCallback,
}: MonarchSettingsModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>(initialCategory);
  const [detailView, setDetailView] = useState<DetailView>(initialDetailView ?? null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCategory(initialCategory);
    const isValidDetailView = initialDetailView && initialDetailView in DETAIL_TITLES;
    setDetailView(isValidDetailView ? initialDetailView : null);
  }, [isOpen, initialCategory, initialDetailView]);

  const handleNavigateToDetail = useCallback((view: DetailView) => {
    setSlideDirection('forward');
    setDetailView(view);
  }, []);

  const handleBack = useCallback(() => {
    setSlideDirection('backward');
    setDetailView(null);
  }, []);

  const handleCategoryChange = useCallback(
    (category: SettingsCategory) => {
      if (detailView) {
        // If in detail view, go back first
        setSlideDirection('backward');
        setDetailView(null);
      }
      setSelectedCategory(category);
    },
    [detailView],
  );

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      if (!open) {
        onCloseCallback?.();
      }
    },
    [onOpenChange, onCloseCallback],
  );

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      size="4xl"
      zIndex="settings"
      scrollBehavior="normal"
      backdrop="blur"
      className="overflow-hidden"
    >
      {(onClose) => (
        <div className="flex h-[70vh] min-h-[500px] max-h-[800px]">
          <SettingsSidebar
            collapsed={sidebarCollapsed}
            onToggle={handleToggleSidebar}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategoryChange}
            disabled={detailView !== null}
          />
          <SettingsContent
            category={selectedCategory}
            detailView={detailView}
            slideDirection={slideDirection}
            onNavigateToDetail={handleNavigateToDetail}
            onBack={handleBack}
            onClose={onClose}
          />
        </div>
      )}
    </Modal>
  );
}
