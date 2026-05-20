import { getAddress, isAddress, type Address } from 'viem';

export type KlerosAddressTag = {
  address: Address;
  chainId: number;
  projectName?: string;
  nameTag?: string;
  publicNote?: string;
  websiteLink?: string;
  dataOriginLink?: string;
};

export type KlerosAddressTagsByKey = Record<string, KlerosAddressTag>;

export const KLEROS_ADDRESS_TAGS_STALE_TIME_MS = 6 * 60 * 60 * 1000;
export const KLEROS_ADDRESS_TAGS_GC_TIME_MS = 24 * 60 * 60 * 1000;

export function getKlerosAddressTagKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export function normalizeKlerosAddress(address: string): Address | null {
  if (!isAddress(address, { strict: false })) {
    return null;
  }

  return getAddress(address);
}

export function normalizeKlerosAddressList(addresses: readonly string[]): Address[] {
  const addressesByLowercase = new Map<string, Address>();

  for (const address of addresses) {
    const normalizedAddress = normalizeKlerosAddress(address);

    if (normalizedAddress) {
      addressesByLowercase.set(normalizedAddress.toLowerCase(), normalizedAddress);
    }
  }

  return [...addressesByLowercase.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

export function formatKlerosAddressTagLabel(tag: KlerosAddressTag | null | undefined): string | undefined {
  if (!tag) {
    return undefined;
  }

  if (tag.projectName && tag.nameTag) {
    return tag.nameTag.toLowerCase().includes(tag.projectName.toLowerCase()) ? tag.nameTag : `${tag.projectName}: ${tag.nameTag}`;
  }

  return tag.nameTag ?? tag.projectName;
}

type FetchKlerosAddressTagsParams = {
  addresses: readonly string[];
  chainId: number;
  signal?: AbortSignal;
};

export async function fetchKlerosAddressTags({
  addresses,
  chainId,
  signal,
}: FetchKlerosAddressTagsParams): Promise<KlerosAddressTagsByKey> {
  const normalizedAddresses = normalizeKlerosAddressList(addresses);

  if (normalizedAddresses.length === 0) {
    return {};
  }

  const response = await fetch('/api/kleros/address-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses: normalizedAddresses, chainId }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Kleros address tag request failed: ${response.status}`);
  }

  const result = (await response.json()) as { tags?: KlerosAddressTagsByKey };
  return result.tags ?? {};
}
