import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { getExplorerTxURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';

type TransactionIdentityProps = {
  txHash: string;
  chainId: SupportedNetworks;
  showFullHash?: boolean;
  className?: string;
};

const formatTxHash = (hash: string, showFull: boolean): string => {
  if (showFull) return hash;
  if (hash.length < 10) return hash;
  return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
};

export function TransactionIdentity({
  txHash,
  chainId,
  showFullHash = false,
  className = '',
}: TransactionIdentityProps) {
  return (
    <Link
      href={getExplorerTxURL(txHash, chainId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-sm bg-hovered px-2 py-1 font-monospace text-[0.65rem] text-secondary no-underline transition-colors hover:bg-gray-300 hover:text-primary hover:no-underline dark:hover:bg-gray-700 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {formatTxHash(txHash, showFullHash)}
      <ExternalLinkIcon className="h-3 w-3" />
    </Link>
  );
}
