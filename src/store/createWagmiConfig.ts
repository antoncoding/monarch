import { createConfig, http } from 'wagmi';
import { arbitrum, base, mainnet, monad, optimism, polygon, unichain } from 'wagmi/chains';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { SupportedNetworks, getDefaultRPC, hyperEvm } from '@/utils/networks';

/**
 * Creates a Wagmi config
 * This config is used when custom RPC URLs are provided
 */
export function createWagmiConfig(customRpcUrls: CustomRpcUrls = {}) {
  // Use custom RPC URLs if provided, otherwise fall back to defaults
  const rpcMainnet = customRpcUrls[SupportedNetworks.Mainnet] ?? getDefaultRPC(SupportedNetworks.Mainnet);
  const rpcOptimism = customRpcUrls[SupportedNetworks.Optimism] ?? getDefaultRPC(SupportedNetworks.Optimism);
  const rpcBase = customRpcUrls[SupportedNetworks.Base] ?? getDefaultRPC(SupportedNetworks.Base);
  const rpcPolygon = customRpcUrls[SupportedNetworks.Polygon] ?? getDefaultRPC(SupportedNetworks.Polygon);
  const rpcUnichain = customRpcUrls[SupportedNetworks.Unichain] ?? getDefaultRPC(SupportedNetworks.Unichain);
  const rpcArbitrum = customRpcUrls[SupportedNetworks.Arbitrum] ?? getDefaultRPC(SupportedNetworks.Arbitrum);
  const rpcHyperEVM = customRpcUrls[SupportedNetworks.HyperEVM] ?? getDefaultRPC(SupportedNetworks.HyperEVM);
  const rpcMonad = customRpcUrls[SupportedNetworks.Monad] ?? getDefaultRPC(SupportedNetworks.Monad);

  return createConfig({
    ssr: true,
    chains: [mainnet, optimism, base, polygon, unichain, arbitrum, hyperEvm, monad],
    transports: {
      [mainnet.id]: http(rpcMainnet),
      [optimism.id]: http(rpcOptimism),
      [base.id]: http(rpcBase),
      [polygon.id]: http(rpcPolygon),
      [unichain.id]: http(rpcUnichain),
      [arbitrum.id]: http(rpcArbitrum),
      [hyperEvm.id]: http(rpcHyperEVM),
      [monad.id]: http(rpcMonad),
    },
  });
}
