import type { Address } from 'viem';
import { getClient } from '@/utils/rpc';
import { adapterFactoryAbi } from '@/abis/morpho-market-v1-adapter-factory';
import { getNetworkConfig, type SupportedNetworks } from '@/utils/networks';

// V1 factory ABI - only the check function we need
const adapterFactoryV1Abi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isMorphoMarketV1Adapter',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// V1 factory addresses (only Base has a separate V1 factory)
const V1_FACTORY_ADDRESSES: Partial<Record<SupportedNetworks, Address>> = {
  // Base V1 factory address if needed in the future
};

type AdapterValidationResult = {
  address: Address;
  isValid: boolean;
};

/**
 * Batch validates adapter addresses against factory contracts.
 * - Checks V2 factory (isMorphoMarketV1AdapterV2) for all networks
 * - For networks with V1 factory, also checks (isMorphoMarketV1Adapter)
 *
 * Returns validation results for each address.
 */
export async function batchIsMorphoMarketV1Adapter(addresses: Address[], chainId: SupportedNetworks): Promise<AdapterValidationResult[]> {
  if (addresses.length === 0) return [];

  const client = getClient(chainId);
  const networkConfig = getNetworkConfig(chainId);
  const v2FactoryAddress = networkConfig.autovaultAddresses?.marketV1AdapterFactory;
  const v1FactoryAddress = V1_FACTORY_ADDRESSES[chainId];

  if (!v2FactoryAddress) {
    // No factory configured for this network
    return addresses.map((addr) => ({ address: addr, isValid: false }));
  }

  // Build multicall contracts for V2 factory
  const v2Contracts = addresses.map((addr) => ({
    address: v2FactoryAddress,
    abi: adapterFactoryAbi,
    functionName: 'isMorphoMarketV1AdapterV2' as const,
    args: [addr],
  }));

  // Build multicall contracts for V1 factory (only if exists)
  const v1Contracts = v1FactoryAddress
    ? addresses.map((addr) => ({
        address: v1FactoryAddress,
        abi: adapterFactoryV1Abi,
        functionName: 'isMorphoMarketV1Adapter' as const,
        args: [addr],
      }))
    : [];

  const contracts = [...v2Contracts, ...v1Contracts];

  const results = await client.multicall({
    contracts,
    allowFailure: true,
  });

  // Process results
  return addresses.map((addr, i) => {
    const v2Result = results[i];
    const v1Result = v1FactoryAddress ? results[addresses.length + i] : null;

    const isV2Valid = v2Result.status === 'success' && v2Result.result === true;
    const isV1Valid = v1Result?.status === 'success' && v1Result.result === true;

    return {
      address: addr,
      isValid: isV2Valid || isV1Valid,
    };
  });
}

/**
 * Validates a single adapter address against factory contracts.
 */
export async function isMorphoMarketV1Adapter(address: Address, chainId: SupportedNetworks): Promise<boolean> {
  const results = await batchIsMorphoMarketV1Adapter([address], chainId);
  return results[0]?.isValid ?? false;
}
