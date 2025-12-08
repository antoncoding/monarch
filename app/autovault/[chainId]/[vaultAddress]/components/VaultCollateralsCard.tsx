import { Card, CardBody, CardHeader } from '@heroui/react';
import { GearIcon } from '@radix-ui/react-icons';
import type { Address } from 'viem';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import type { VaultV2Cap } from '@/data-sources/morpho-api/v2-vaults';
import { parseCapIdParams } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';

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
    .map((cap) => {
      const parsed = parseCapIdParams(cap.idParams);
      return parsed.collateralToken;
    })
    .filter((token): token is Address => !!token);

  const hasCollaterals = collateralTokens.length > 0;

  return (
    <Card className={cardStyle}>
      <CardHeader className="flex items-center justify-between pb-2">
        <span className="text-xs uppercase tracking-wide text-secondary">Collaterals</span>
        {isOwner && <GearIcon className="h-4 w-4 cursor-pointer text-secondary hover:text-primary" onClick={onManageCaps} />}
      </CardHeader>
      <CardBody className="flex items-center justify-center py-3">
        {isLoading ? (
          <Spinner size={16} />
        ) : hasCollaterals ? (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {collateralTokens.map((tokenAddress) => (
              <div key={tokenAddress} className="flex items-center">
                <TokenIcon address={tokenAddress} chainId={chainId} width={20} height={20} />
              </div>
            ))}
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
