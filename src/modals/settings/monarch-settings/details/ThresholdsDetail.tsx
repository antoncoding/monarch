'use client';

import { Input } from '@/components/ui/input';
import { useMarketPreferences } from '@/stores/useMarketPreferences';

export function ThresholdsDetail() {
  const { usdMinSupply, setUsdMinSupply, usdMinBorrow, setUsdMinBorrow, usdMinLiquidity, setUsdMinLiquidity } = useMarketPreferences();

  const handleThresholdChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (/^\d*$/.test(value)) {
      setter(value);
    }
  };

  const thresholds = [
    {
      key: 'supply',
      label: 'Min Supply',
      description: 'Only show markets where total supplied assets meet this USD threshold.',
      value: usdMinSupply,
      setter: setUsdMinSupply,
    },
    {
      key: 'borrow',
      label: 'Min Borrow',
      description: 'Only show markets where total borrowed assets meet this USD threshold.',
      value: usdMinBorrow,
      setter: setUsdMinBorrow,
    },
    {
      key: 'liquidity',
      label: 'Min Liquidity',
      description: 'Only show markets where available liquidity meets this USD threshold.',
      value: usdMinLiquidity,
      setter: setUsdMinLiquidity,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-secondary">
        Set minimum USD values for market filters. Enable or disable these filters from the Filters button on the markets page.
      </p>

      <div className="flex flex-col gap-3">
        {thresholds.map((threshold) => (
          <div
            key={threshold.key}
            className="flex items-center justify-between gap-4 rounded border border-border p-3 transition-colors hover:border-primary/30"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-primary">{threshold.label}</span>
              <span className="text-xs text-secondary">{threshold.description}</span>
            </div>
            <Input
              aria-label={threshold.label}
              placeholder="0"
              value={threshold.value}
              onChange={handleThresholdChange(threshold.setter)}
              size="sm"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              className="w-28"
              classNames={{ input: 'text-right' }}
              startContent={<span className="text-small text-primary">$</span>}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
