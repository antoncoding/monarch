import { useMemo } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { type Address, maxUint128 } from 'viem';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { MarketIdentity, MarketIdentityFocus } from '@/features/markets/components/market-identity';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import type { CapData } from '@/hooks/useVaultV2Data';
import { parseCapIdParams } from '@/utils/morpho';
import { findToken } from '@/utils/tokens';

type CurrentCapsProps = {
  existingCaps?: CapData;
  isOwner: boolean;
  onStartEdit: () => void;
  vaultAsset?: Address;
  chainId: number;
};

export function CurrentCaps({ existingCaps, isOwner, onStartEdit, chainId, vaultAsset }: CurrentCapsProps) {
  const { markets, loading: marketsLoading } = useProcessedMarkets();

  const vaultAssetToken = vaultAsset ? findToken(vaultAsset, chainId) : undefined;
  const vaultAssetDecimals = vaultAssetToken?.decimals ?? 18;

  // Format absolute cap value
  const formatAbsoluteCap = (cap: string | undefined): string => {
    if (!cap || cap === '') {
      return 'No limit';
    }

    try {
      const capBigInt = BigInt(cap);
      if (capBigInt === 0n || capBigInt >= maxUint128) {
        return 'No limit';
      }
      const value = Number(capBigInt) / 10 ** vaultAssetDecimals;
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } catch (_e) {
      return cap;
    }
  };

  const hasAnyCaps =
    existingCaps && (existingCaps.adapterCap !== null || existingCaps.collateralCaps.length > 0 || existingCaps.marketCaps.length > 0);

  // Build collateral cap lookup with market counts
  const { collateralCapMap, marketCountByCollateral } = useMemo(() => {
    const capMap = new Map<string, { relativeCap: number; absoluteCap: string }>();
    const countMap = new Map<string, number>();

    // Build collateral cap lookup
    existingCaps?.collateralCaps.forEach((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      if (parsed.collateralToken) {
        capMap.set(parsed.collateralToken.toLowerCase(), {
          relativeCap: Number(cap.relativeCap) / 1e16,
          absoluteCap: cap.absoluteCap,
        });
      }
    });

    // Count markets per collateral
    existingCaps?.marketCaps.forEach((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      const collateralAddr = parsed.marketParams?.collateralToken?.toLowerCase();
      if (collateralAddr) {
        countMap.set(collateralAddr, (countMap.get(collateralAddr) ?? 0) + 1);
      }
    });

    return { collateralCapMap: capMap, marketCountByCollateral: countMap };
  }, [existingCaps]);

  // Build market-centric view with constraints
  const marketCapsWithConstraints = useMemo(() => {
    return (
      existingCaps?.marketCaps
        .map((cap) => {
          const parsed = parseCapIdParams(cap.idParams);
          const collateralAddr = parsed.marketParams?.collateralToken?.toLowerCase();
          const marketCapPercent = Number(cap.relativeCap) / 1e16;

          const collateralInfo = collateralAddr ? collateralCapMap.get(collateralAddr) : null;
          const collateralCapPercent = collateralInfo?.relativeCap ?? Number.POSITIVE_INFINITY;
          const collateralAbsoluteCap = collateralInfo?.absoluteCap;

          // Effective cap is the smaller of market cap or collateral cap
          const effectiveCap = Math.min(marketCapPercent, collateralCapPercent);
          const effectiveAbsoluteCap = collateralCapPercent < marketCapPercent ? collateralAbsoluteCap : cap.absoluteCap;

          // Determine if collateral is constraining this market
          const isCollateralConstraining = collateralCapPercent < marketCapPercent;
          const sharedMarketCount = collateralAddr ? (marketCountByCollateral.get(collateralAddr) ?? 0) : 0;

          const market = markets.find((m) => m.uniqueKey.toLowerCase() === (parsed.marketId ?? '').toLowerCase());

          return {
            cap,
            market,
            marketCap: marketCapPercent,
            marketAbsoluteCap: cap.absoluteCap,
            collateralCap: collateralCapPercent,
            collateralAbsoluteCap,
            effectiveCap,
            effectiveAbsoluteCap,
            isCollateralConstraining,
            collateralAddr,
            sharedMarketCount,
          };
        })
        .filter((item) => item.market !== undefined && item.effectiveCap > 0) ?? []
    );
  }, [existingCaps, markets, collateralCapMap, marketCountByCollateral]);

  if (marketsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase text-secondary">Allocation Caps</p>
          <p className="text-xs text-secondary">
            Caps limit how much of the vault can be allocated to each market. The effective cap shown is the smaller of the market cap and
            its collateral cap.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              variant="default"
              size="sm"
              onClick={onStartEdit}
            >
              {hasAnyCaps ? 'Edit caps' : 'Add caps'}
            </Button>
          )}
        </div>
      </div>

      {/* Market List */}
      {hasAnyCaps && marketCapsWithConstraints.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase text-secondary">Configured Caps ({marketCapsWithConstraints.length})</p>

          <div className="space-y-2">
            {marketCapsWithConstraints.map((item) => (
              <div
                key={item.cap.capId}
                className="rounded bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <MarketIdentity
                    market={item.market!}
                    chainId={chainId}
                    focus={MarketIdentityFocus.Collateral}
                    showLltv
                    showOracle
                    iconSize={20}
                  />
                  {/* Effective cap with absolute value */}
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    <span className="font-medium text-primary">{item.effectiveCap.toFixed(2)}%</span>
                    {formatAbsoluteCap(item.effectiveAbsoluteCap) !== 'No limit' && (
                      <span className="text-secondary">· {formatAbsoluteCap(item.effectiveAbsoluteCap)}</span>
                    )}
                  </div>
                </div>

                {/* Collateral constraint indicator - show for ANY constraint */}
                {item.isCollateralConstraining && (
                  <div className="ml-7 mt-2 flex items-center gap-1.5 text-xs text-secondary">
                    <InfoCircledIcon className="h-3 w-3 shrink-0" />
                    <span>
                      Collateral limit: <span className="text-primary">{item.collateralCap.toFixed(2)}%</span>
                      {formatAbsoluteCap(item.collateralAbsoluteCap) !== 'No limit' && (
                        <span> · {formatAbsoluteCap(item.collateralAbsoluteCap)}</span>
                      )}
                      {item.sharedMarketCount > 1 && (
                        <span className="text-secondary"> (shared with {item.sharedMarketCount} markets)</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded bg-hovered/30 p-6 text-center">
          <p className="text-sm text-secondary">No caps configured yet</p>
          <p className="mt-1 text-xs text-secondary">Set caps to control how agents allocate funds across markets</p>
        </div>
      )}
    </div>
  );
}
