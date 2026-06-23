'use client';

import { IoWarningOutline } from 'react-icons/io5';
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { TokenIcon } from '@/components/shared/token-icon';
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
  return (
    <div className="rounded bg-surface-soft p-3">
      <SettingToggleItem
        title={`${asset.symbol} ${roleLabel}`}
        description={
          <div className="flex min-w-0 items-center gap-2">
            <TokenIcon
              address={asset.address}
              chainId={chainId}
              width={18}
              height={18}
              symbol={asset.symbol}
            />
            <span className="truncate">{asset.name}</span>
          </div>
        }
        selected={selected}
        onChange={onChange}
        ariaLabel={`Toggle ${asset.symbol} asset blacklist`}
        color="destructive"
      />
    </div>
  );
}

type BlacklistAssetsModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market | null;
  onAssetAdded?: (symbol: string) => void;
  onAssetRemoved?: (symbol: string) => void;
};

export function BlacklistAssetsModal({ isOpen, onOpenChange, market, onAssetAdded, onAssetRemoved }: BlacklistAssetsModalProps) {
  const { addBlacklistedAsset, removeBlacklistedAsset, isAssetBlacklisted } = useBlacklistedAssets();

  if (!market) return null;

  const chainId = market.morphoBlue.chain.id;
  const assets = [
    { token: market.loanAsset, label: 'loan asset' },
    { token: market.collateralAsset, label: 'collateral asset' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
    >
      <ModalHeader
        variant="compact"
        mainIcon={<IoWarningOutline className="h-5 w-5 text-orange-500" />}
        title="Blacklist Assets"
        description="Hide every market that uses these assets"
        className="border-b border-primary/10"
        onClose={() => onOpenChange(false)}
      />
      <ModalBody
        variant="compact"
        className="py-6"
      >
        <div className="flex flex-col gap-3">
          <div className="rounded bg-orange-500/10 p-3 text-xs text-secondary">
            Switch on an asset to hide all markets where it appears as loan or collateral. You can remove assets later in Settings.
          </div>

          {assets.map(({ token, label }) => {
            const selected = isAssetBlacklisted(chainId, token.address);

            return (
              <AssetSwitchRow
                key={getAssetBlacklistKey(chainId, token.address)}
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
                    if (added) onAssetAdded?.(token.symbol);
                    return;
                  }

                  removeBlacklistedAsset(chainId, token.address);
                  onAssetRemoved?.(token.symbol);
                }}
              />
            );
          })}
        </div>
      </ModalBody>
      <ModalFooter className="border-t border-primary/10">
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
