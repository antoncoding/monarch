'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { TokenIcon } from '@/components/shared/token-icon';
import { AccountIdentity } from '@/components/shared/account-identity';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';

type PositionBreadcrumbsProps = {
  userAddress: string;
  chainId: SupportedNetworks;
  loanAssetAddress: string;
  loanAssetSymbol?: string;
};

export function PositionBreadcrumbs({ userAddress, chainId, loanAssetAddress, loanAssetSymbol }: PositionBreadcrumbsProps) {
  const networkImg = getNetworkImg(chainId);
  const networkName = getNetworkName(chainId);

  return (
    <nav className="flex items-center gap-2 text-sm text-secondary">
      {/* Link back to all positions */}
      <Link
        href={`/positions/${userAddress}`}
        className="flex items-center gap-1.5 hover:text-primary transition-colors"
      >
        <AccountIdentity
          address={userAddress as `0x${string}`}
          chainId={chainId}
          variant="badge"
          showActions={false}
          linkTo="none"
        />
      </Link>

      <ChevronRightIcon className="h-4 w-4 text-border" />

      {/* Current position: Chain + Asset */}
      <div className="flex items-center gap-1.5">
        {networkImg && (
          <Image
            src={networkImg}
            alt={networkName ?? `Chain ${chainId}`}
            width={14}
            height={14}
          />
        )}
        <TokenIcon
          address={loanAssetAddress}
          chainId={chainId}
          symbol={loanAssetSymbol ?? ''}
          width={14}
          height={14}
        />
        <span className="text-primary">{loanAssetSymbol ?? 'Position'}</span>
      </div>
    </nav>
  );
}
