'use client';

import { Cross2Icon } from '@radix-ui/react-icons';
import { TokenIcon } from '@/components/shared/token-icon';
import { Button } from '@/components/ui/button';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getAssetBlacklistKey, type BlacklistedAsset, useBlacklistedAssets } from '@/stores/useBlacklistedAssets';
import { getSlicedAddress } from '@/utils/address';

const getAssetLabel = (asset: Pick<BlacklistedAsset, 'address' | 'name' | 'symbol'>) =>
  asset.symbol || asset.name || getSlicedAddress(asset.address) || 'Asset';

export function BlacklistedAssetsDetail() {
  const customBlacklistedAssets = useBlacklistedAssets((state) => state.customBlacklistedAssets);
  const removeBlacklistedAsset = useBlacklistedAssets((state) => state.removeBlacklistedAsset);
  const { success: toastSuccess } = useStyledToast();

  const blacklistedAssets = [...customBlacklistedAssets].sort((a, b) => getAssetLabel(a).localeCompare(getAssetLabel(b)));

  if (blacklistedAssets.length === 0) {
    return (
      <div className="rounded bg-surface p-4 text-xs text-secondary">
        No assets are hidden. Use a market actions menu to hide every market involving one of its assets.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {blacklistedAssets.map((asset) => {
        const label = getAssetLabel(asset);

        return (
          <div
            key={getAssetBlacklistKey(asset.chainId, asset.address)}
            className="flex items-center justify-between gap-3 rounded bg-surface p-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <TokenIcon
                address={asset.address}
                chainId={asset.chainId}
                width={22}
                height={22}
                symbol={asset.symbol || 'Unknown'}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-primary">{label}</div>
                <div className="text-xs text-secondary">Chain {asset.chainId}</div>
              </div>
            </div>
            <Button
              size="xs"
              variant="default"
              aria-label={`Remove ${label} from blacklist`}
              onClick={() => {
                removeBlacklistedAsset(asset.chainId, asset.address);
                toastSuccess('Asset removed from blacklist', `${label} markets are now visible`);
              }}
              className="shrink-0"
            >
              <Cross2Icon className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
