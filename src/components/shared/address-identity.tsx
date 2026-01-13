import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Avatar } from '@/components/Avatar/Avatar';
import { TokenIcon } from '@/components/shared/token-icon';
import { getExplorerURL } from '@/utils/external';

type AddressIdentityProps = {
  address: string;
  chainId: number;
  label?: string;
  isToken?: boolean;
  tokenSymbol?: string;
};

/**
 * Use to display address, not Account. Better used for contracts
 * @param param0
 * @returns
 */
export function AddressIdentity({ address, chainId, label, isToken, tokenSymbol }: AddressIdentityProps) {
  return (
    <Link
      href={getExplorerURL(address as `0x${string}`, chainId)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-sm bg-hovered px-2 py-1 text-xs text-secondary no-underline hover:bg-gray-300 dark:hover:bg-gray-700"
    >
      {isToken ? (
        <TokenIcon
          address={address}
          chainId={chainId}
          symbol={tokenSymbol ?? ''}
          width={14}
          height={14}
        />
      ) : (
        <Avatar
          address={address as `0x${string}`}
          size={14}
        />
      )}
      {label && <span>{label}</span>}
      <span className="font-mono text-[11px]">
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <ExternalLinkIcon className="h-3 w-3" />
    </Link>
  );
}
