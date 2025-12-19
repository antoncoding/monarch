import { useRateLabel } from '@/hooks/useRateLabel';
import { MetricPreview } from './metric-preview';

type ApyPreviewProps = {
  currentApy: number;
  previewApy?: number | null;
};

/**
 * APY/APR preview component.
 * Thin wrapper around MetricPreview for rate-specific usage.
 */
export function ApyPreview({ currentApy, previewApy }: ApyPreviewProps) {
  const { short: rateLabel } = useRateLabel();
  return (
    <MetricPreview
      currentValue={currentApy}
      previewValue={previewApy}
      label={rateLabel}
    />
  );
}
