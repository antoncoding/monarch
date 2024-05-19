import { useCallback } from 'react';
import { Name } from '@coinbase/onchainkit/identity';
import { ExitIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useAccount, useDisconnect } from 'wagmi';
import { Avatar } from '@/components/Avatar/Avatar';
import { getSlicedAddress } from '@/utils/address';
import { getExplorerURL } from '@/utils/external';

export function AccountInfoPanel() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const handleDisconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  if (!address) return null;

  return (
    <>
      <div className="mb-4 inline-flex items-center justify-start gap-2 text-sm">
        <Avatar address={address} />
        <div className="inline-flex flex-col items-start justify-center gap-1">
          <div className="font-inter text-primary w-32 text-sm font-medium">
            <Name address={address} />
          </div>
          <span className="font-inter w-32 text-xs font-medium text-zinc-400">
            {getSlicedAddress(address)}
          </span>
        </div>
        <Link href={getExplorerURL(address)} target="_blank">
          <ExternalLinkIcon className="relative h-4 w-4" />
        </Link>
      </div>
      <hr className="text-primary h-px self-stretch border-transparent bg-opacity-20" />
      <button
        type="button"
        aria-label="Disconnect"
        className="my-4 inline-flex items-center justify-between self-stretch"
        onClick={handleDisconnectWallet}
      >
        <span className="font-inter text-primary w-32 text-left text-sm font-medium">Log out</span>
        <ExitIcon className="relative h-4 w-4" />
      </button>
    </>
  );
}
