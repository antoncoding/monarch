import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import { Button } from '@/components/common';
import { useConnectRedirect } from '@/components/providers/ConnectRedirectProvider';
import { AccountDropdown } from './AccountDropdown';

/**
 * Custom wallet connection button using AppKit hooks
 */
function AccountConnect({ onConnectPath }: { onConnectPath?: string }) {
  const { open } = useAppKit();
  const { isConnected } = useAccount();
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
      className="flex flex-grow transition-all duration-300 ease-in-out hover:opacity-80"
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
        <div className="block flex">
          <AccountDropdown />
        </div>
      ) : (
        <Button onPress={handleConnect} type="button" variant="cta">
          Connect
        </Button>
      )}
    </div>
  );
}

export default AccountConnect;
