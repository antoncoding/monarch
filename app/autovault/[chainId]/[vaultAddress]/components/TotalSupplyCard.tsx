import React, { useMemo, useState } from 'react';
import { PlusIcon } from '@radix-ui/react-icons';
import { Address } from 'viem';
import { TokenIcon } from '@/components/TokenIcon';
import { formatBalance } from '@/utils/balance';
import { DepositToVaultModal } from './DepositToVaultModal';

type VaultTotalAssetsCardProps = {
  totalAssets?: bigint
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

  const handleDepositSuccess = () => {
    setShowDepositModal(false);
    onRefresh?.();
  };

  return (
    <>
      <div className="rounded bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
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
        </div>
        <div className="mt-3 flex items-center gap-2 text-base text-primary">
          <span className='text-2lg'>{totalAssetsLabel}</span>
          {assetAddress && (
            <TokenIcon address={assetAddress} chainId={chainId} width={20} height={20} />
          )}
        </div>
      </div>

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
