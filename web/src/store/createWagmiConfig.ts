import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, rainbowWallet, coinbaseWallet, rabbyWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { getChainsForEnvironment } from './supportedChains';

export function createWagmiConfig(projectId: string) {
  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Recommended Wallet',
        wallets: [rabbyWallet, rainbowWallet],
      },
      {
        groupName: 'Other Wallets',
        wallets: [rainbowWallet, coinbaseWallet, metaMaskWallet],
      },
    ],
    {
      appName: 'buildonchainapps',
      projectId,
    },
  );

  return createConfig({
    ssr: true,
    chains: getChainsForEnvironment(),
    transports: {
      [mainnet.id]: http(),
    },
    connectors,
  });
}
