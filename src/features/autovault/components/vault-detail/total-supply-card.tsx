import { useMemo, useCallback } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { GoPlusCircle } from 'react-icons/go';
import { GoArrowUpRight } from 'react-icons/go';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatBalance } from '@/utils/balance';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultPage } from '@/hooks/useVaultPage';
import { useModal } from '@/hooks/useModal';
import type { SupportedNetworks } from '@/utils/networks';

type VaultTotalAssetsCardProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
};

export function TotalSupplyCard({ vaultAddress, chainId }: VaultTotalAssetsCardProps): JSX.Element {
  const { address: connectedAddress } = useConnection();
  const { open: openModal } = useModal();

  // Pull data directly - TanStack Query deduplicates
  const { data: vaultData, isLoading: vaultDataLoading } = useVaultV2Data({ vaultAddress, chainId });
  const {
    totalAssets,
    isLoading: contractLoading,
    refetch,
  } = useVaultV2({
    vaultAddress,
    chainId,
    connectedAddress,
  });
  const { vault24hEarnings } = useVaultPage({ vaultAddress, chainId, connectedAddress });

  const tokenDecimals = vaultData?.tokenDecimals;
  const tokenSymbol = vaultData?.tokenSymbol;
  const assetAddress = vaultData?.assetAddress as Address | undefined;
  const vaultName = vaultData?.displayName ?? '';
  const isLoading = vaultDataLoading || contractLoading;

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

  const handleSuccess = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleOpenDeposit = useCallback(() => {
    if (!assetAddress || !tokenSymbol || tokenDecimals === undefined) return;

    openModal('vaultDeposit', {
      vaultAddress,
      vaultName,
      assetAddress,
      assetSymbol: tokenSymbol,
      assetDecimals: tokenDecimals,
      chainId,
      onSuccess: handleSuccess,
    });
  }, [assetAddress, tokenSymbol, tokenDecimals, vaultAddress, vaultName, chainId, openModal, handleSuccess]);

  const handleOpenWithdraw = useCallback(() => {
    if (!assetAddress || !tokenSymbol || tokenDecimals === undefined) return;

    openModal('vaultWithdraw', {
      vaultAddress,
      vaultName,
      assetAddress,
      assetSymbol: tokenSymbol,
      assetDecimals: tokenDecimals,
      chainId,
      onSuccess: handleSuccess,
    });
  }, [assetAddress, tokenSymbol, tokenDecimals, vaultAddress, vaultName, chainId, openModal, handleSuccess]);

  const cardStyle = 'bg-surface rounded shadow-sm';

  return (
    <Card className={cardStyle}>
      <CardHeader className="flex items-center justify-between pb-2">
        <span className="text-xs uppercase tracking-wide text-secondary">Total Assets</span>
        {assetAddress && tokenSymbol && tokenDecimals !== undefined && (
          <div className="flex items-center gap-2">
            <Tooltip content="Withdraw from vault">
              <button
                type="button"
                onClick={handleOpenWithdraw}
                className="flex h-4 w-4 items-center justify-center rounded-full transition-colors text-secondary hover:text-primary"
                aria-label="Withdraw from vault"
              >
                <GoArrowUpRight className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip content="Deposit to vault">
              <button
                type="button"
                onClick={handleOpenDeposit}
                className="flex h-4 w-4 items-center justify-center rounded-full transition-colors text-secondary hover:text-primary"
                aria-label="Deposit to vault"
              >
                <GoPlusCircle className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </CardHeader>
      <CardBody className="flex items-center justify-center py-3">
        {isLoading ? (
          <div className="bg-hovered h-6 w-32 rounded animate-pulse" />
        ) : (
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
                  <span>{earnings24hLabel}</span>
                </div>
              </Tooltip>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
