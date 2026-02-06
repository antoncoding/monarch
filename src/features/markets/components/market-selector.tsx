import { formatUnits } from 'viem';
import { getTruncatedAssetName } from '@/utils/oracle';
import type { Market } from '@/utils/types';
import OracleVendorBadge from './oracle-vendor-badge';
import { TokenIcon } from '@/components/shared/token-icon';

type MarketSelectorProps = {
  market: Market;
  onAdd: () => void;
  disabled?: boolean;
};

export function MarketSelector({ market, onAdd, disabled = false }: MarketSelectorProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="w-full rounded border border-gray-100 bg-gray-50/50 p-3 text-left transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-50 disabled:hover:border-gray-100 disabled:hover:bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/50 dark:hover:border-primary"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <div className="z-10">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={20}
                height={20}
              />
            </div>
            <div className="bg-surface -ml-2.5">
              <TokenIcon
                address={market.collateralAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.collateralAsset.symbol}
                width={20}
                height={20}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{getTruncatedAssetName(market.loanAsset.symbol)}</span>
            <span className="text-xs opacity-50">/ {getTruncatedAssetName(market.collateralAsset.symbol)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-70">
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              oracleAddress={market.oracleAddress}
              showText={false}
              chainId={market.morphoBlue.chain.id}
            />
            <span>·</span>
            <span>{market.state?.supplyApy ? (market.state.supplyApy * 100).toFixed(2) : '0.00'}% APY</span>
            <span>·</span>
            <span>{formatUnits(BigInt(market.lltv), 16)}% LTV</span>
          </div>
        </div>
        <div className="rounded bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Add</div>
      </div>
    </button>
  );
}
