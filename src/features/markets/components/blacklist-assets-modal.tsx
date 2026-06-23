'use client';

import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { TokenIcon } from '@/components/shared/token-icon';
import { useStyledToast } from '@/hooks/useStyledToast';
import { SettingToggleItem } from '@/modals/settings/monarch-settings/SettingItem';
import { getAssetBlacklistKey, useBlacklistedAssets } from '@/stores/useBlacklistedAssets';
import type { Market, TokenInfo } from '@/utils/types';

function AssetSwitchRow({
  asset,
  chainId,
  selected,
  onChange,
  roleLabel,
}: {
  asset: TokenInfo;
  chainId: number;
  selected: boolean;
  onChange: (selected: boolean) => void;
  roleLabel: string;
}) {
  const assetSymbol = asset.symbol || 'Unknown';
  const assetName = asset.name || 'Unknown asset';

  return (
    <div className="rounded bg-surface p-3">
      <SettingToggleItem
        title={`${assetSymbol} ${roleLabel}`}
        description={
          <div className="flex min-w-0 items-center gap-2">
            <TokenIcon
              address={asset.address}
              chainId={chainId}
              width={18}
              height={18}
              symbol={assetSymbol}
            />
            <span className="truncate">{assetName}</span>
          </div>
        }
        selected={selected}
        onChange={onChange}
        ariaLabel={`Toggle ${assetSymbol} asset blacklist`}
        color="destructive"
      />
    </div>
  );
}

type BlacklistAssetsModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market | null;
};

export function BlacklistAssetsModal({ isOpen, onOpenChange, market }: BlacklistAssetsModalProps) {
  const addBlacklistedAsset = useBlacklistedAssets((state) => state.addBlacklistedAsset);
  const removeBlacklistedAsset = useBlacklistedAssets((state) => state.removeBlacklistedAsset);
  const isAssetBlacklisted = useBlacklistedAssets((state) => state.isAssetBlacklisted);
  const { success: toastSuccess } = useStyledToast();

  if (!market) return null;

  const chainId = market.morphoBlue.chain.id;
  const loanAssetKey = getAssetBlacklistKey(chainId, market.loanAsset.address);
  const collateralAssetKey = getAssetBlacklistKey(chainId, market.collateralAsset.address);
  const assets =
    loanAssetKey === collateralAssetKey
      ? [{ key: loanAssetKey, token: market.loanAsset, label: 'loan and collateral asset' }]
      : [
          { key: loanAssetKey, token: market.loanAsset, label: 'loan asset' },
          { key: collateralAssetKey, token: market.collateralAsset, label: 'collateral asset' },
        ];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
    >
      <ModalHeader
        variant="compact"
        title="Blacklist Assets"
        description="Hide markets that use this loan or collateral asset."
        onClose={() => onOpenChange(false)}
      />
      <ModalBody variant="compact">
        <div className="flex flex-col gap-3">
          {assets.map(({ key, token, label }) => {
            const selected = isAssetBlacklisted(chainId, token.address);
            const assetSymbol = token.symbol || 'Asset';

            return (
              <AssetSwitchRow
                key={key}
                asset={token}
                chainId={chainId}
                roleLabel={label}
                selected={selected}
                onChange={(nextSelected) => {
                  if (nextSelected) {
                    const added = addBlacklistedAsset({
                      address: token.address,
                      chainId,
                      symbol: token.symbol,
                      name: token.name,
                    });
                    if (added) toastSuccess('Asset blacklisted', `${assetSymbol} markets are now hidden`);
                    return;
                  }

                  removeBlacklistedAsset(chainId, token.address);
                  toastSuccess('Asset removed from blacklist', `${assetSymbol} markets are now visible`);
                }}
              />
            );
          })}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          size="md"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      </ModalFooter>
    </Modal>
  );
}
