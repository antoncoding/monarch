import { Card, CardBody, CardHeader } from '@/components/ui/card';
import type { Address } from 'viem';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';

type VaultCollateralsCardProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  needsInitialization: boolean;
};

export function VaultCollateralsCard({ vaultAddress, chainId, needsInitialization }: VaultCollateralsCardProps) {
  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData, isLoading: vaultDataLoading } = useVaultV2Data({ vaultAddress, chainId });

  const collateralCaps = vaultData?.capsData?.collateralCaps ?? [];
  const isLoading = vaultDataLoading;

  const cardStyle = 'bg-surface rounded shadow-sm';
  const maxDisplay = 5;
  const iconSize = 20;

  const collateralTokens = collateralCaps
    .map((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      return parsed.collateralToken;
    })
    .filter((token): token is Address => !!token);

  const hasCollaterals = collateralTokens.length > 0;
  const preview = collateralTokens.slice(0, maxDisplay);
  const remaining = collateralTokens.slice(maxDisplay);

  return (
    <Card className={cardStyle}>
      <CardHeader className="pb-2">
        <span className="text-xs uppercase tracking-wide text-secondary">Collaterals</span>
      </CardHeader>
      <CardBody className="flex items-center justify-center py-3">
        {isLoading ? (
          <div className="bg-hovered h-5 w-24 rounded animate-pulse" />
        ) : needsInitialization ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-xs text-secondary">Setup required</span>
            </div>
          </div>
        ) : hasCollaterals ? (
          <div className="flex items-center justify-center">
            {preview.map((tokenAddress, index) => (
              <div
                key={tokenAddress}
                className={`relative ${index === 0 ? 'ml-0' : '-ml-2'}`}
                style={{ zIndex: preview.length - index }}
              >
                <TokenIcon
                  address={tokenAddress}
                  chainId={chainId}
                  width={iconSize}
                  height={iconSize}
                />
              </div>
            ))}
            {remaining.length > 0 && (
              <Tooltip
                content={
                  <TooltipContent
                    title={<span className="text-sm font-semibold">More collaterals</span>}
                    detail={
                      <div className="flex flex-col gap-2">
                        {remaining.map((tokenAddress) => (
                          <div
                            key={tokenAddress}
                            className="flex items-center gap-2"
                          >
                            <TokenIcon
                              address={tokenAddress}
                              chainId={chainId}
                              width={16}
                              height={16}
                            />
                          </div>
                        ))}
                      </div>
                    }
                  />
                }
              >
                <span
                  className="-ml-2 flex items-center justify-center rounded-full border border-background/40 bg-hovered text-[11px] text-secondary"
                  style={{
                    width: iconSize,
                    height: iconSize,
                    zIndex: 0,
                  }}
                >
                  +{remaining.length}
                </span>
              </Tooltip>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-secondary">None configured</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
