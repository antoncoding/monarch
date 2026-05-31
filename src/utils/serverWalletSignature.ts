import 'server-only';

import { createPublicClient, http, type Address, type Chain } from 'viem';
import { verifyMessage } from 'viem/actions';
import { arbitrum, base, etherlink, hyperEvm, mainnet, monad, optimism, polygon, unichain } from 'viem/chains';
import { SupportedNetworks } from '@/utils/supported-networks';

export const SIGNATURE_PATTERN = /^0x(?:[0-9a-fA-F]{2})+$/;

const VERIFICATION_CHAINS: Record<SupportedNetworks, Chain> = {
  [SupportedNetworks.Mainnet]: mainnet,
  [SupportedNetworks.Optimism]: optimism,
  [SupportedNetworks.Base]: base,
  [SupportedNetworks.Polygon]: polygon,
  [SupportedNetworks.Unichain]: unichain,
  [SupportedNetworks.Arbitrum]: arbitrum,
  [SupportedNetworks.Etherlink]: etherlink,
  [SupportedNetworks.HyperEVM]: hyperEvm,
  [SupportedNetworks.Monad]: monad,
};

const RPC_ENV_BY_CHAIN: Partial<Record<SupportedNetworks, string | undefined>> = {
  [SupportedNetworks.Mainnet]: process.env.NEXT_PUBLIC_ETHEREUM_RPC,
  [SupportedNetworks.Optimism]: process.env.NEXT_PUBLIC_OPTIMISM_RPC,
  [SupportedNetworks.Base]: process.env.NEXT_PUBLIC_BASE_RPC,
  [SupportedNetworks.Polygon]: process.env.NEXT_PUBLIC_POLYGON_RPC,
  [SupportedNetworks.Unichain]: process.env.NEXT_PUBLIC_UNICHAIN_RPC,
  [SupportedNetworks.Arbitrum]: process.env.NEXT_PUBLIC_ARBITRUM_RPC,
  [SupportedNetworks.Etherlink]: process.env.NEXT_PUBLIC_ETHERLINK_RPC,
  [SupportedNetworks.HyperEVM]: process.env.NEXT_PUBLIC_HYPEREVM_RPC,
  [SupportedNetworks.Monad]: process.env.NEXT_PUBLIC_MONAD_RPC,
};

export function verifyWalletSignature({
  address,
  chainId,
  message,
  signature,
}: {
  address: string;
  chainId: SupportedNetworks;
  message: string;
  signature: string;
}) {
  const rpcUrl = RPC_ENV_BY_CHAIN[chainId]?.trim() || undefined;
  const client = createPublicClient({
    chain: VERIFICATION_CHAINS[chainId],
    transport: http(rpcUrl),
  });

  return verifyMessage(client, {
    address: address as Address,
    message,
    signature: signature as `0x${string}`,
  });
}
