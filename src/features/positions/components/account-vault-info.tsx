'use client';

import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import type { Address } from 'viem';
import { AccountIdentity } from '@/components/shared/account-identity';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { VaultAccountIdentity } from '@/contexts/VaultRegistryContext';
import { useVaultAccountIdentity } from '@/hooks/useVaultAccountIdentity';
import { useVaultV2Data, type VaultV2Data } from '@/hooks/useVaultV2Data';
import { getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { getMonarchVaultHref } from '@/utils/vaults';

type AccountVaultInfoProps = {
  account: Address;
};

export function AccountVaultInfo({ account }: AccountVaultInfoProps) {
  const vaultIdentity = useVaultAccountIdentity(account);

  if (!vaultIdentity || vaultIdentity.kind === 'vault-adapter') {
    return null;
  }

  if (vaultIdentity.kind === 'vault-v2') {
    return <VaultV2Info vaultIdentity={vaultIdentity} />;
  }

  return <VaultInfoRow vaultIdentity={vaultIdentity} />;
}

function VaultV2Info({ vaultIdentity }: { vaultIdentity: VaultAccountIdentity }) {
  const vaultDataQuery = useVaultV2Data({
    vaultAddress: vaultIdentity.vaultAddress,
    chainId: vaultIdentity.chainId as SupportedNetworks,
  });

  return (
    <VaultInfoRow
      vaultIdentity={vaultIdentity}
      vaultData={vaultDataQuery.data}
    />
  );
}

function VaultInfoRow({ vaultIdentity, vaultData }: { vaultIdentity: VaultAccountIdentity; vaultData?: VaultV2Data | null }) {
  const curatorAddress = vaultData?.curator || undefined;
  const assetAddress = vaultIdentity.assetAddress ?? vaultData?.assetAddress;
  const assetSymbol = vaultIdentity.assetSymbol ?? vaultData?.tokenSymbol;
  const displayName = vaultData?.displayName || vaultIdentity.displayName;
  const monarchVaultHref = getMonarchVaultHref(vaultIdentity.chainId, vaultIdentity.vaultAddress);
  const networkName = getNetworkName(vaultIdentity.chainId) ?? `Chain ${vaultIdentity.chainId}`;

  return (
    <section className="mt-2 flex flex-wrap items-center gap-2 text-xs text-secondary">
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-hovered px-2 py-1">
        <NetworkIcon
          networkId={vaultIdentity.chainId}
          size={14}
        />
        {networkName}
      </span>
      {assetSymbol && (
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-hovered px-2 py-1">
          {assetAddress && (
            <TokenIcon
              address={assetAddress}
              chainId={vaultIdentity.chainId}
              width={14}
              height={14}
              disableTooltip
            />
          )}
          {assetSymbol}
        </span>
      )}
      {vaultIdentity.kind === 'vault-v2' && (
        <Tooltip
          content={
            <TooltipContent
              title="Open vault"
              detail={`View ${displayName} on Monarch.`}
            />
          }
        >
          <Button
            asChild
            size="icon"
            variant="ghost"
            className="h-6 min-w-0 px-1.5 text-secondary hover:text-primary"
          >
            <Link
              href={monarchVaultHref}
              aria-label="Open vault"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </Tooltip>
      )}
      {curatorAddress && (
        <div className="inline-flex items-center gap-1.5 rounded-sm bg-hovered px-2 py-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-secondary/70">Curator</span>
          <AccountIdentity
            address={curatorAddress as Address}
            chainId={vaultIdentity.chainId}
            variant="badge"
            showActions={false}
            linkTo="profile"
            className="!bg-transparent !px-0 !py-0"
          />
        </div>
      )}
    </section>
  );
}
