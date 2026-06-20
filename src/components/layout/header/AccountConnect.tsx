import { useConnection } from 'wagmi';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConnectRedirect } from '@/components/providers/ConnectRedirectProvider';
import { useWalletModal } from '@/components/providers/WalletModalProvider';
import { AccountDropdown } from './AccountDropdown';

function AccountConnect({ onConnectPath }: { onConnectPath?: string }) {
  const { isConnected } = useConnection();
  const { setRedirectPath } = useConnectRedirect();
  const { openWalletModal } = useWalletModal();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = () => {
    setRedirectPath(onConnectPath);
    openWalletModal();
  };

  return (
    <div
      className="flex shrink-0 transition-all duration-300 ease-in-out hover:opacity-80"
      {...(!mounted && {
        'aria-hidden': true,
        style: {
          opacity: 0,
          pointerEvents: 'none',
          userSelect: 'none',
        },
      })}
    >
      {isConnected ? (
        <div className="flex">
          <AccountDropdown />
        </div>
      ) : (
        <Button
          onClick={handleConnect}
          type="button"
          variant="primary"
        >
          Connect
        </Button>
      )}
    </div>
  );
}

export default AccountConnect;
