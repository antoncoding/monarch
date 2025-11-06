import React from 'react';
import { formatReadable } from '@/utils/balance';

type ApyPreviewProps = {
  currentApy: number;
  previewApy?: number | null;
};

/**
 * Standardized APY preview component.
 * Shows current APY in a fixed position, and appends preview to the right when available.
 * This ensures perfect vertical alignment across all uses.
 */
export function ApyPreview({ currentApy, previewApy }: ApyPreviewProps) {
  const formattedCurrent = formatReadable(currentApy * 100);
  const formattedPreview = previewApy ? formatReadable(previewApy * 100) : null;
  const hasPreview = Boolean(previewApy && formattedPreview);

  const currentClasses = `text-foreground${hasPreview ? ' line-through opacity-50' : ''}`;

  return (
    <span className="whitespace-nowrap text-sm font-semibold">
      <span className={currentClasses}>{formattedCurrent}%</span>
      {hasPreview && (
        <>
          {' → '}
          <span className="text-foreground">{formattedPreview}%</span>
        </>
      )}
    </span>
  );
}
