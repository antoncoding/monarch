import { SupportedNetworks } from './networks';

export const URLS = {
  MORPHO_BLUE_API: 'https://blue-api.morpho.org/graphql',

  // only returns morpho reward, won't include merkl rewards
  MORPHO_REWARDS_API: 'https://rewards.morpho.org/v1',
} as const;

export const MONARCH_AGENT_URLS: Record<SupportedNetworks, string> = {
  [SupportedNetworks.Base]: 'https://api.studio.thegraph.com/query/110397/monarch-agent-base/version/latest',
  [SupportedNetworks.Polygon]: 'https://api.studio.thegraph.com/query/110397/monarch-agent-polygon/version/latest',
} as Record<SupportedNetworks, string>;

// Helper function to get URL by chainId, returns undefined if not supported
export const getMonarchAgentUrl = (chainId: number): string | undefined => {
  if (chainId === SupportedNetworks.Base) {
    return MONARCH_AGENT_URLS[SupportedNetworks.Base];
  }
  if (chainId === SupportedNetworks.Polygon) {
    return MONARCH_AGENT_URLS[SupportedNetworks.Polygon];
  }
  return undefined;
};
