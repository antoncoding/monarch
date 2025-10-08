import { Button } from '@/components/common';

type VaultApyHistoryProps = {
  timeframes: string[];
};

export function VaultApyHistory({ timeframes }: VaultApyHistoryProps) {
  return (
    <div className="bg-surface flex h-full flex-col rounded p-4 shadow-sm font-zen">
      <div className="mb-4 flex items-center justify-between">
        <div>
        <h3 className="text-lg text-secondary">Historical APY</h3>
          <p className="text-xs text-secondary">Performance data updates every epoch.</p>
        </div>
        <div className="flex gap-2">
          {timeframes.map((frame) => (
            <Button key={frame} variant="ghost" size="sm" className="px-2 py-1">
              {frame}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex-1 rounded bg-hovered">
        <div className="flex h-full items-center justify-center text-secondary">
          APY chart coming soon
        </div>
      </div>
    </div>
  );
}
