import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { createConfig, http } from 'wagmi';
import { arbitrum, base, mainnet, monad, polygon, unichain } from 'wagmi/chains';
import type { CustomRpcUrls } from '@/hooks/useCustomRpc';
import { SupportedNetworks, getDefaultRPC, hyperEvm } from '@/utils/networks';

/**
 * Creates a Wagmi config with vanilla connectors (no RainbowKit)
 * This config is used when custom RPC URLs are provided
 */
export function createWagmiConfig(projectId: string, customRpcUrls: CustomRpcUrls = {}) {
  // Use custom RPC URLs if provided, otherwise fall back to defaults
  const rpcMainnet = customRpcUrls[SupportedNetworks.Mainnet] ?? getDefaultRPC(SupportedNetworks.Mainnet);
  const rpcBase = customRpcUrls[SupportedNetworks.Base] ?? getDefaultRPC(SupportedNetworks.Base);
  const rpcPolygon = customRpcUrls[SupportedNetworks.Polygon] ?? getDefaultRPC(SupportedNetworks.Polygon);
  const rpcUnichain = customRpcUrls[SupportedNetworks.Unichain] ?? getDefaultRPC(SupportedNetworks.Unichain);
  const rpcArbitrum = customRpcUrls[SupportedNetworks.Arbitrum] ?? getDefaultRPC(SupportedNetworks.Arbitrum);
  const rpcHyperEVM = customRpcUrls[SupportedNetworks.HyperEVM] ?? getDefaultRPC(SupportedNetworks.HyperEVM);
  const rpcMonad = customRpcUrls[SupportedNetworks.Monad] ?? getDefaultRPC(SupportedNetworks.Monad);

  return createConfig({
    ssr: true,
    chains: [mainnet, base, polygon, unichain, arbitrum, hyperEvm, monad],
    transports: {
      [mainnet.id]: http(rpcMainnet),
      [base.id]: http(rpcBase),
      [polygon.id]: http(rpcPolygon),
      [unichain.id]: http(rpcUnichain),
      [arbitrum.id]: http(rpcArbitrum),
      [hyperEvm.id]: http(rpcHyperEVM),
      [monad.id]: http(rpcMonad),
    },
    connectors: [
      injected(),
      walletConnect({ projectId }),
      coinbaseWallet({ appName: 'Monarch' }),
    ],
  });
}
