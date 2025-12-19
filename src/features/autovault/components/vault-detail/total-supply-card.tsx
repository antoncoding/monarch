import { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, Tooltip } from '@heroui/react';
import { PlusIcon } from '@radix-ui/react-icons';
import { TbTrendingUp } from 'react-icons/tb';
import type { Address } from 'viem';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatBalance } from '@/utils/balance';
import { DepositToVaultModal } from './modals/deposit-to-vault-modal';

type VaultTotalAssetsCardProps = {
  totalAssets?: bigint;
  vault24hEarnings?: bigint | null;
  tokenDecimals?: number;
  tokenSymbol?: string;
  assetAddress?: Address;
  chainId: number;
  vaultAddress: Address;
  vaultName: string;
  onRefresh?: () => void;
};

export function TotalSupplyCard({
  tokenDecimals,
  tokenSymbol,
  assetAddress,
  chainId,
  vaultAddress,
  vaultName,
  totalAssets,
  vault24hEarnings,
  onRefresh,
}: VaultTotalAssetsCardProps): JSX.Element {
  const [showDepositModal, setShowDepositModal] = useState(false);

  const totalAssetsLabel = useMemo(() => {
    if (totalAssets === undefined || tokenDecimals === undefined) return '--';

    try {
      const numericAssets = formatBalance(totalAssets, tokenDecimals);
      const formattedAssets = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(numericAssets);

      return `${formattedAssets}${tokenSymbol ? ` ${tokenSymbol}` : ''}`.trim();
    } catch (_error) {
      return '--';
    }
  }, [tokenDecimals, tokenSymbol, totalAssets]);

  const earnings24hLabel = useMemo(() => {
    if (vault24hEarnings === null || vault24hEarnings === undefined || tokenDecimals === undefined) return null;

    try {
      const earningsValue = formatBalance(vault24hEarnings, tokenDecimals);

      if (earningsValue === 0) return null;

      const formatted = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 4,
        minimumFractionDigits: 2,
      }).format(earningsValue);

      return `+${formatted}`;
    } catch (_error) {
      return null;
    }
  }, [vault24hEarnings, tokenDecimals]);

  const handleDepositSuccess = () => {
    setShowDepositModal(false);
    onRefresh?.();
  };

  const cardStyle = 'bg-surface rounded shadow-sm';

  return (
    <>
      <Card className={cardStyle}>
        <CardHeader className="flex items-center justify-between pb-2">
          <span className="text-xs uppercase tracking-wide text-secondary">Total Assets</span>
          {assetAddress && tokenSymbol && tokenDecimals !== undefined && (
            <button
              type="button"
              onClick={() => setShowDepositModal(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
              aria-label="Deposit to vault"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          )}
        </CardHeader>
        <CardBody className="flex items-center justify-center py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg text-primary">{totalAssetsLabel}</span>
            {assetAddress && (
              <TokenIcon
                address={assetAddress}
                chainId={chainId}
                width={20}
                height={20}
              />
            )}
            {earnings24hLabel && (
              <Tooltip content="Total yield earned in the last 24 hours">
                <div className="flex items-center gap-1 text-xs text-green-500">
                  <TbTrendingUp className="h-3 w-3" />
                  <span>{earnings24hLabel}</span>
                </div>
              </Tooltip>
            )}
          </div>
        </CardBody>
      </Card>

      {showDepositModal && assetAddress && tokenSymbol && tokenDecimals !== undefined && (
        <DepositToVaultModal
          vaultAddress={vaultAddress}
          vaultName={vaultName}
          assetAddress={assetAddress}
          assetSymbol={tokenSymbol}
          assetDecimals={tokenDecimals}
          chainId={chainId}
          onClose={() => setShowDepositModal(false)}
          onSuccess={handleDepositSuccess}
        />
      )}
    </>
  );
}
