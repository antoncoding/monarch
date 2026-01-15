'use client';

import { cn } from '@/utils/components';
import { CHART_PALETTES, PALETTE_META } from '@/constants/chartColors';
import { CHART_PALETTE_NAMES, type ChartPaletteName } from '@/stores/useChartPalette';

type PaletteOptionProps = {
  paletteId: ChartPaletteName;
  selected: boolean;
  onSelect: () => void;
};

function ColorSwatches({ paletteId }: { paletteId: ChartPaletteName }) {
  const palette = CHART_PALETTES[paletteId];
  const colors = [
    palette.supply.stroke,
    palette.borrow.stroke,
    palette.apyAtTarget.stroke,
    palette.risk.stroke,
  ];

  return (
    <div className="flex gap-1.5">
      {colors.map((color, index) => (
        <div
          key={index}
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function PaletteOption({ paletteId, selected, onSelect }: PaletteOptionProps) {
  const meta = PALETTE_META[paletteId];
  if (!meta) return null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-2 rounded border-2 p-4 text-left transition-all duration-200',
        selected
          ? 'border-primary bg-surface'
          : 'border-border/50 bg-surface/50 hover:border-border hover:bg-surface',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary">{meta.name}</span>
        {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      <span className="text-xs text-secondary">{meta.description}</span>
      <ColorSwatches paletteId={paletteId} />
    </button>
  );
}

export function PaletteSelector({
  selectedPalette,
  onSelect,
}: {
  selectedPalette: ChartPaletteName;
  onSelect: (palette: ChartPaletteName) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CHART_PALETTE_NAMES.map((id) => (
        <PaletteOption
          key={id}
          paletteId={id}
          selected={selectedPalette === id}
          onSelect={() => onSelect(id)}
        />
      ))}
    </div>
  );
}
