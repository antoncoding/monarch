import React from 'react';
import { MetricPreview } from './MetricPreview';

type ApyPreviewProps = {
  currentApy: number;
  previewApy?: number | null;
};

/**
 * APY preview component.
 * Thin wrapper around MetricPreview for APY-specific usage.
 */
export function ApyPreview({ currentApy, previewApy }: ApyPreviewProps) {
  return <MetricPreview currentValue={currentApy} previewValue={previewApy} label="APY" />;
}
