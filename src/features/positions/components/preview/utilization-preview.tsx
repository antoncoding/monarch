import { MetricPreview } from './metric-preview';

type UtilizationPreviewProps = {
  currentUtilization: number;
  previewUtilization?: number | null;
};

/**
 * Utilization preview component.
 * Thin wrapper around MetricPreview for utilization-specific usage.
 */
export function UtilizationPreview({ currentUtilization, previewUtilization }: UtilizationPreviewProps) {
  return (
    <MetricPreview
      currentValue={currentUtilization}
      previewValue={previewUtilization}
      label="Utilization"
    />
  );
}
