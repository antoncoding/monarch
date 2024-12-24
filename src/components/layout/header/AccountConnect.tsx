import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAccountEffect } from 'wagmi';
import { Button } from '@/components/common';
import { AccountDropdown } from './AccountDropdown';

/**
 *
 * @returns
 */
function AccountConnect({ onConnectPath }: { onConnectPath?: string }) {
  const router = useRouter();

  useAccountEffect({
    onConnect: ({ address, isReconnected }) => {
      console.log('isReconnected', isReconnected, onConnectPath);

      // Your on-connect logic here
      if (onConnectPath && !isReconnected) {
        toast.success('Address connected, redirecting...', { toastId: 'address-connected' });
        router.push(`/${onConnectPath}/${address}`);
      }
    },
  });

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            className="flex flex-grow opacity-80 transition-all duration-300 ease-in-out hover:opacity-100"
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} type="button" variant="cta">
                    Connect
                  </Button>
                );
              }

              return (
                <div className="block flex">
                  <AccountDropdown />
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

export default AccountConnect;
