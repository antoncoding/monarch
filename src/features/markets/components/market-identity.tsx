import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import OracleVendorBadge from '@/features/markets/components/oracle-vendor-badge';
import { TokenIcon } from '@/components/shared/token-icon';
import { getTruncatedAssetName } from '@/utils/oracle';
import type { Market, TokenInfo } from '@/utils/types';

export enum MarketIdentityMode {
  Normal = 'normal',
  Focused = 'focused',
  Minimum = 'minimum',
  Badge = 'badge',
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
  showId?: boolean;
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
  showId = false,
  iconSize = 20,
  showExplorerLink = false,
  wide = false,
}: MarketIdentityProps) {
  const lltv = (Number(market.lltv) / 1e16).toFixed(0);
  const loanSymbol = getTruncatedAssetName(market.loanAsset.symbol);
  const collateralAsset = (market.collateralAsset as TokenInfo | null) ?? null;
  const collateralSymbol = collateralAsset ? getTruncatedAssetName(collateralAsset.symbol) : 'Idle Market';

  // Badge mode: show ID - icon - LLTV% or just symbol
  if (mode === MarketIdentityMode.Badge) {
    return (
      <div className="flex items-center gap-1.5">
        <MarketIdBadge
          marketId={market.uniqueKey}
          chainId={chainId}
          showLink={false}
        />
        {collateralAsset ? (
          <>
            <TokenIcon
              address={collateralAsset.address}
              chainId={chainId}
              symbol={collateralAsset.symbol}
              width={16}
              height={16}
              customTooltipTitle={collateralAsset.symbol}
              customTooltipDetail="Collateral Asset in this market"
            />
            <span className="text-xs opacity-70">{lltv}%</span>
          </>
        ) : (
          <span className="text-xs">{collateralSymbol}</span>
        )}
      </div>
    );
  }

  const tokenStack = (
    <div className="flex items-center flex-shrink-0">
      <div className={`${focus === MarketIdentityFocus.Loan ? 'z-10' : 'z-0'}`}>
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
      {collateralAsset ? (
        <div className={`${focus === MarketIdentityFocus.Collateral ? 'z-10' : 'z-0'} -ml-1`}>
          <TokenIcon
            address={collateralAsset.address}
            chainId={chainId}
            symbol={collateralAsset.symbol}
            width={iconSize}
            height={iconSize}
            customTooltipTitle={collateralAsset.symbol}
            customTooltipDetail="Collateral Asset in this market"
            showExplorerLink={showExplorerLink}
          />
        </div>
      ) : null}
    </div>
  );

  // Minimum mode: only show focused token
  if (mode === MarketIdentityMode.Minimum) {
    const isLoanFocus = focus === MarketIdentityFocus.Loan;
    const token = isLoanFocus ? market.loanAsset : collateralAsset;
    const role = focus === MarketIdentityFocus.Loan ? 'Loan Asset' : 'Collateral Asset';
    const label = isLoanFocus ? loanSymbol : collateralSymbol;

    if (wide) {
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {showId && (
              <MarketIdBadge
                marketId={market.uniqueKey}
                chainId={chainId}
                showLink={false}
              />
            )}
            {token ? (
              <>
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
                <span className="text-sm whitespace-nowrap">{label}</span>
              </>
            ) : (
              <span className="text-sm whitespace-nowrap">{label}</span>
            )}
          </div>
          {showLltv && <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">{lltv}%</span>}
          {showOracle && (
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              chainId={chainId}
              useTooltip
              showText={false}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {showId && (
          <MarketIdBadge
            marketId={market.uniqueKey}
            chainId={chainId}
            showLink={false}
          />
        )}
        {token ? (
          <>
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
            <span className="text-sm whitespace-nowrap">{label}</span>
          </>
        ) : (
          <span className="text-sm whitespace-nowrap">{label}</span>
        )}
        {showLltv && <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">{lltv}% LLTV</span>}
        {showOracle && (
          <OracleVendorBadge
            oracleData={market.oracle?.data}
            chainId={chainId}
            useTooltip
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
            {showId && (
              <MarketIdBadge
                marketId={market.uniqueKey}
                chainId={chainId}
                showLink={true}
              />
            )}
            {tokenStack}
            <div className="flex items-center gap-2">
              <span className={`whitespace-nowrap ${isLoanFocused ? 'text-sm' : 'text-xs text-secondary'}`}>{loanSymbol}</span>
              {collateralAsset ? (
                <>
                  <span className="text-xs text-secondary">/</span>
                  <span className={`whitespace-nowrap ${isLoanFocused ? 'text-xs text-secondary' : 'text-sm'}`}>{collateralSymbol}</span>
                </>
              ) : (
                <span className={`whitespace-nowrap ${isLoanFocused ? 'text-xs text-secondary' : 'text-sm'}`}>{collateralSymbol}</span>
              )}
            </div>
          </div>
          {showLltv && <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">{lltv}% LLTV</span>}
          {showOracle && (
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              chainId={chainId}
              useTooltip
              showText={false}
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        {showId && (
          <MarketIdBadge
            marketId={market.uniqueKey}
            chainId={chainId}
            showLink={true}
          />
        )}
        {tokenStack}
        <div className="flex items-center gap-2">
          <span className={`whitespace-nowrap ${isLoanFocused ? 'text-sm' : 'text-xs text-secondary'}`}>{loanSymbol}</span>
          {collateralAsset ? (
            <>
              <span className="text-xs text-secondary">/</span>
              <span className={`whitespace-nowrap ${isLoanFocused ? 'text-xs text-secondary' : 'text-sm'}`}>{collateralSymbol}</span>
            </>
          ) : (
            <span className={`whitespace-nowrap ${isLoanFocused ? 'text-xs text-secondary' : 'text-sm'}`}>{collateralSymbol}</span>
          )}
          {showLltv && <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">{lltv}% LLTV</span>}
          {showOracle && (
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              chainId={chainId}
              useTooltip
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
          {showId && (
            <MarketIdBadge
              marketId={market.uniqueKey}
              chainId={chainId}
              showLink={false}
            />
          )}
          {tokenStack}
          <div className="flex items-center gap-2">
            <span className="text-sm whitespace-nowrap">{loanSymbol}</span>
            {collateralAsset ? (
              <span className="text-sm whitespace-nowrap">/ {collateralSymbol}</span>
            ) : (
              <span className="text-sm whitespace-nowrap">{collateralSymbol}</span>
            )}
          </div>
        </div>
        {showLltv && <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">{lltv}% LLTV</span>}
        {showOracle && (
          <OracleVendorBadge
            oracleData={market.oracle?.data}
            chainId={chainId}
            useTooltip
            showText={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {showId && (
        <MarketIdBadge
          marketId={market.uniqueKey}
          chainId={chainId}
          showLink={false}
        />
      )}
      {tokenStack}
      <div className="flex items-center gap-2">
        <span className="text-sm whitespace-nowrap">{loanSymbol}</span>
        {collateralAsset ? (
          <span className="text-sm whitespace-nowrap">/ {collateralSymbol}</span>
        ) : (
          <span className="text-sm whitespace-nowrap">{collateralSymbol}</span>
        )}
        {showLltv && <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">{lltv}% LLTV</span>}
        {showOracle && (
          <OracleVendorBadge
            oracleData={market.oracle?.data}
            chainId={chainId}
            useTooltip
            showText={false}
          />
        )}
      </div>
    </div>
  );
}
