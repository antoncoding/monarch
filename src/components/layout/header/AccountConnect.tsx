import { useAppKit } from '@reown/appkit/react';
import { useConnection } from 'wagmi';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConnectRedirect } from '@/components/providers/ConnectRedirectProvider';
import { AccountDropdown } from './AccountDropdown';

/**
 * Custom wallet connection button using AppKit hooks
 */
function AccountConnect({ onConnectPath }: { onConnectPath?: string }) {
  const { open } = useAppKit();
  const { isConnected } = useConnection();
  const { setRedirectPath } = useConnectRedirect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = () => {
    setRedirectPath(onConnectPath);
    open();
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
