import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { Button } from '@/components/common';
import { useConnectRedirect } from '@/components/providers/ConnectRedirectProvider';
import { AccountDropdown } from './AccountDropdown';

/**
 *
 * @returns
 */
function AccountConnect({ onConnectPath }: { onConnectPath?: string }) {
  const { setRedirectPath } = useConnectRedirect();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        const handleClicked = () => {
          setRedirectPath(onConnectPath);
          openConnectModal();
        };

        return (
          <div
            className="flex flex-grow transition-all duration-300 ease-in-out hover:opacity-80"
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
                  <Button onClick={handleClicked} type="button" variant="cta">
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
