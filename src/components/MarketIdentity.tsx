import { TokenIcon } from '@/components/TokenIcon';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { Market } from '@/utils/types';
import { getTruncatedAssetName } from '@/utils/oracle';

export enum MarketIdentityMode {
  Normal = 'normal',
  Focused = 'focused',
  Minimum = 'minimum',
}

export enum MarketIdentityFocus {
  Loan = 'loan',
  Collateral = 'collateral',
}

type MarketIdentityProps = {
  market: Market;
  chainId: number;
  mode?: MarketIdentityMode;
  focus?: MarketIdentityFocus;
  showLltv?: boolean;
  showOracle?: boolean;
  iconSize?: number;
  showExplorerLink?: boolean;
  wide?: boolean;
};

export function MarketIdentity({
  market,
  chainId,
  mode = MarketIdentityMode.Focused,
  focus = MarketIdentityFocus.Loan,
  showLltv = true,
  showOracle = true,
  iconSize = 20,
  showExplorerLink = false,
  wide = false,
}: MarketIdentityProps) {
  const lltv = (Number(market.lltv) / 1e16).toFixed(0);
  const loanSymbol = getTruncatedAssetName(market.loanAsset.symbol);
  const collateralSymbol = getTruncatedAssetName(market.collateralAsset.symbol);

  // Minimum mode: only show focused token
  if (mode === MarketIdentityMode.Minimum) {
    const token = focus === MarketIdentityFocus.Loan ? market.loanAsset : market.collateralAsset;
    const role = focus === MarketIdentityFocus.Loan ? 'Loan Asset' : 'Collateral Asset';

    if (wide) {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <TokenIcon
              address={token.address}
              chainId={chainId}
              symbol={token.symbol}
              width={iconSize}
              height={iconSize}
              customTooltipTitle={token.symbol}
              customTooltipDetail={`${role} in this market`}
              showExplorerLink={showExplorerLink}
            />
            <span className="text-sm whitespace-nowrap">{getTruncatedAssetName(token.symbol)}</span>
          </div>
          {showLltv && (
            <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">
              {lltv}% LLTV
            </span>
          )}
          {showOracle && (
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              chainId={chainId}
              useTooltip={true}
              showText={false}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <TokenIcon
          address={token.address}
          chainId={chainId}
          symbol={token.symbol}
          width={iconSize}
          height={iconSize}
          customTooltipTitle={token.symbol}
          customTooltipDetail={`${role} in this market`}
          showExplorerLink={showExplorerLink}
        />
        <span className="text-sm whitespace-nowrap">{getTruncatedAssetName(token.symbol)}</span>
        {showLltv && (
          <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">
            {lltv}% LLTV
          </span>
        )}
        {showOracle && (
          <OracleVendorBadge
            oracleData={market.oracle?.data}
            chainId={chainId}
            useTooltip={true}
            showText={false}
          />
        )}
      </div>
    );
  }

  // Focused mode: show both tokens with focus styling (always loan first)
  if (mode === MarketIdentityMode.Focused) {
    const isLoanFocused = focus === MarketIdentityFocus.Loan;

    if (wide) {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="flex items-center flex-shrink-0">
              <div className="z-10">
                <TokenIcon
                  address={market.loanAsset.address}
                  chainId={chainId}
                  symbol={market.loanAsset.symbol}
                  width={iconSize}
                  height={iconSize}
                  customTooltipTitle={market.loanAsset.symbol}
                  customTooltipDetail="Loan Asset in this market"
                  showExplorerLink={showExplorerLink}
                />
              </div>
              <div className="bg-surface -ml-2.5">
                <TokenIcon
                  address={market.collateralAsset.address}
                  chainId={chainId}
                  symbol={market.collateralAsset.symbol}
                  width={iconSize}
                  height={iconSize}
                  customTooltipTitle={market.collateralAsset.symbol}
                  customTooltipDetail="Collateral Asset in this market"
                  showExplorerLink={showExplorerLink}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`whitespace-nowrap ${isLoanFocused ? 'text-sm' : 'text-xs text-secondary'}`}>
                {loanSymbol}
              </span>
              <span className="text-xs text-secondary">/</span>
              <span className={`whitespace-nowrap ${isLoanFocused ? 'text-xs text-secondary' : 'text-sm'}`}>
                {collateralSymbol}
              </span>
            </div>
          </div>
          {showLltv && (
            <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">
              {lltv}% LLTV
            </span>
          )}
          {showOracle && (
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              chainId={chainId}
              useTooltip={true}
              showText={false}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center flex-shrink-0">
          <div className="z-10">
            <TokenIcon
              address={market.loanAsset.address}
              chainId={chainId}
              symbol={market.loanAsset.symbol}
              width={iconSize}
              height={iconSize}
              customTooltipTitle={market.loanAsset.symbol}
              customTooltipDetail="Loan Asset in this market"
              showExplorerLink={showExplorerLink}
            />
          </div>
          <div className="bg-surface -ml-2.5">
            <TokenIcon
              address={market.collateralAsset.address}
              chainId={chainId}
              symbol={market.collateralAsset.symbol}
              width={iconSize}
              height={iconSize}
              customTooltipTitle={market.collateralAsset.symbol}
              customTooltipDetail="Collateral Asset in this market"
              showExplorerLink={showExplorerLink}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`whitespace-nowrap ${isLoanFocused ? 'text-sm' : 'text-xs text-secondary'}`}>
            {loanSymbol}
          </span>
          <span className="text-xs text-secondary">/</span>
          <span className={`whitespace-nowrap ${isLoanFocused ? 'text-xs text-secondary' : 'text-sm'}`}>
            {collateralSymbol}
          </span>
          {showLltv && (
            <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">
              {lltv}% LLTV
            </span>
          )}
          {showOracle && (
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              chainId={chainId}
              useTooltip={true}
              showText={false}
            />
          )}
        </div>
      </div>
    );
  }

  // Normal mode: show both tokens equally (no styling difference)
  if (wide) {
    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center flex-shrink-0">
            <div className="z-10">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={chainId}
                symbol={market.loanAsset.symbol}
                width={iconSize}
                height={iconSize}
                customTooltipTitle={market.loanAsset.symbol}
                customTooltipDetail="Loan Asset in this market"
                showExplorerLink={showExplorerLink}
              />
            </div>
            <div className="bg-surface -ml-2.5">
              <TokenIcon
                address={market.collateralAsset.address}
                chainId={chainId}
                symbol={market.collateralAsset.symbol}
                width={iconSize}
                height={iconSize}
                customTooltipTitle={market.collateralAsset.symbol}
                customTooltipDetail="Collateral Asset in this market"
                showExplorerLink={showExplorerLink}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm whitespace-nowrap">{loanSymbol}</span>
            <span className="text-sm whitespace-nowrap">/ {collateralSymbol}</span>
          </div>
        </div>
        {showLltv && (
          <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">
            {lltv}% LLTV
          </span>
        )}
        {showOracle && (
          <OracleVendorBadge
            oracleData={market.oracle?.data}
            chainId={chainId}
            useTooltip={true}
            showText={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center flex-shrink-0">
        <div className="z-10">
          <TokenIcon
            address={market.loanAsset.address}
            chainId={chainId}
            symbol={market.loanAsset.symbol}
            width={iconSize}
            height={iconSize}
            customTooltipTitle={market.loanAsset.symbol}
            customTooltipDetail="Loan Asset in this market"
            showExplorerLink={showExplorerLink}
          />
        </div>
        <div className="bg-surface -ml-2.5">
          <TokenIcon
            address={market.collateralAsset.address}
            chainId={chainId}
            symbol={market.collateralAsset.symbol}
            width={iconSize}
            height={iconSize}
            customTooltipTitle={market.collateralAsset.symbol}
            customTooltipDetail="Collateral Asset in this market"
            showExplorerLink={showExplorerLink}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm whitespace-nowrap">{loanSymbol}</span>
        <span className="text-sm whitespace-nowrap">/ {collateralSymbol}</span>
        {showLltv && (
          <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">
            {lltv}% LLTV
          </span>
        )}
        {showOracle && (
          <OracleVendorBadge
            oracleData={market.oracle?.data}
            chainId={chainId}
            useTooltip={true}
            showText={false}
          />
        )}
      </div>
    </div>
  );
}
