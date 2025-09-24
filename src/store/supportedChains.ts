import { arbitrum, base, Chain, mainnet, polygon, unichain } from 'viem/chains';

/**
 * Gets the list of supported chains for a given environment.
 * Defaults to the current environment.
 * @param env
 */
export function getChainsForEnvironment() {
  return [mainnet, base, polygon, unichain, arbitrum] as readonly Chain[];
}

