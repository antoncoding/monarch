import { http, type HttpTransportConfig } from 'viem';
import { SupportedNetworks } from './supported-networks';

const KATANA_RPC_API_KEY = process.env.NEXT_PUBLIC_KATANA_RPC_API_KEY?.trim();
const TATUM_GATEWAY_HOST_SUFFIX = '.gateway.tatum.io';
const TATUM_GATEWAY_HOST = 'gateway.tatum.io';

const isTatumGatewayUrl = (rpcUrl: string): boolean => {
  try {
    const hostname = new URL(rpcUrl).hostname.toLowerCase();
    return hostname === TATUM_GATEWAY_HOST || hostname.endsWith(TATUM_GATEWAY_HOST_SUFFIX);
  } catch {
    return false;
  }
};

export const getRpcRequestHeaders = (chainId: number, rpcUrl: string): Record<string, string> | undefined => {
  if (chainId !== SupportedNetworks.Katana || !KATANA_RPC_API_KEY || !isTatumGatewayUrl(rpcUrl)) {
    return undefined;
  }

  return {
    'x-api-key': KATANA_RPC_API_KEY,
  };
};

export const getRpcHttpConfig = (chainId: number, rpcUrl: string): HttpTransportConfig | undefined => {
  const headers = getRpcRequestHeaders(chainId, rpcUrl);
  if (!headers) {
    return undefined;
  }

  return {
    fetchOptions: {
      headers,
    },
  };
};

export const createRpcTransport = (chainId: SupportedNetworks, rpcUrl: string) => http(rpcUrl, getRpcHttpConfig(chainId, rpcUrl));
