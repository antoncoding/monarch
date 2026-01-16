'use client';

import { useState, useCallback, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { SettingsSidebar } from './SettingsSidebar';
import { SettingsContent } from './SettingsContent';
import type { SettingsCategory, DetailView } from './constants';

type MonarchSettingsModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialCategory?: SettingsCategory;
};

export function MonarchSettingsModal({ isOpen, onOpenChange, initialCategory = 'transaction' }: MonarchSettingsModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategory>(initialCategory);
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedCategory(initialCategory);
      setDetailView(null);
    }
  }, [isOpen, initialCategory]);

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

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
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
