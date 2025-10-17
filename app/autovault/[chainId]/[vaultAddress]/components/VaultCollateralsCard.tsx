import { Card, CardBody, CardHeader } from '@heroui/react';
import { GearIcon } from '@radix-ui/react-icons';
import { Address } from 'viem';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { parseCapIdParams } from '@/utils/morpho';
import { SupportedNetworks } from '@/utils/networks';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';

type VaultCollateralsCardProps = {
  collateralCaps: VaultV2Cap[];
  chainId: SupportedNetworks;
  onManageCaps: () => void;
  needsSetup?: boolean;
  isOwner?: boolean;
  isLoading?: boolean;
};

export function VaultCollateralsCard({
  collateralCaps,
  chainId,
  onManageCaps,
  needsSetup = false,
  isOwner = false,
  isLoading = false,
}: VaultCollateralsCardProps) {
  const cardStyle = 'bg-surface rounded shadow-sm';

  if (needsSetup) {
    return null;
  }

  const collateralTokens = collateralCaps
    .map(cap => {
      const parsed = parseCapIdParams(cap.idParams);
      return parsed.collateralToken;
    })
    .filter((token): token is Address => !!token);

  const hasCollaterals = collateralTokens.length > 0;

  return (
    <Card className={cardStyle}>
      <CardHeader className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-secondary">Collaterals</span>
        {isOwner && (
          <GearIcon className="h-4 w-4 cursor-pointer text-secondary hover:text-primary" onClick={onManageCaps} />
        )}
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size={16} />
          </div>
        ) : hasCollaterals ? (
          <div className="flex flex-wrap gap-2">
            {collateralTokens.map((tokenAddress) => (
              <div key={tokenAddress} className="flex items-center gap-1">
                <TokenIcon
                  address={tokenAddress}
                  chainId={chainId}
                  width={24}
                  height={24}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            <span className="text-sm text-secondary">None configured</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
