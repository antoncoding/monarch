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

const KLEROS_SCOUT_ADDRESS_TAGS_URL = 'https://scout-api.kleros.link/api/address-tags';
const MAX_ADDRESSES_PER_REQUEST = 50;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const text = value.trim();
  return text.length > 0 ? text : undefined;
}

function readHttpUrl(value: unknown): string | undefined {
  const text = readText(value);

  if (!text) {
    return undefined;
  }

  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseScoutTag(address: KlerosAddressTag['address'], chainId: number, value: unknown): KlerosAddressTag | null {
  if (!isRecord(value) || readText(value.chain_id) !== String(chainId)) {
    return null;
  }

  const projectName = readText(value.project_name);
  const nameTag = readText(value.name_tag);

  if (!projectName && !nameTag) {
    return null;
  }

  return {
    address,
    chainId,
    projectName,
    nameTag,
    publicNote: readText(value.public_note),
    websiteLink: readHttpUrl(value.website_link),
    dataOriginLink: readHttpUrl(value.data_origin_link),
  };
}

function normalizeScoutResponse(value: unknown, chainId: number): KlerosAddressTagsByKey {
  if (!isRecord(value) || !Array.isArray(value.addresses)) {
    return {};
  }

  const tags: KlerosAddressTagsByKey = {};

  for (const addressEntry of value.addresses) {
    if (!isRecord(addressEntry)) {
      continue;
    }

    for (const [rawAddress, rawTags] of Object.entries(addressEntry)) {
      const address = normalizeKlerosAddress(rawAddress);

      if (!address || !Array.isArray(rawTags)) {
        continue;
      }

      for (const rawTag of rawTags) {
        const tag = parseScoutTag(address, chainId, rawTag);

        if (tag) {
          tags[getKlerosAddressTagKey(chainId, address)] = tag;
          break;
        }
      }
    }
  }

  return tags;
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
  const normalizedAddresses = normalizeKlerosAddressList(addresses).slice(0, MAX_ADDRESSES_PER_REQUEST);

  if (normalizedAddresses.length === 0) {
    return {};
  }

  try {
    const response = await fetch(KLEROS_SCOUT_ADDRESS_TAGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: normalizedAddresses,
        chains: [String(chainId)],
      }),
      signal,
    });

    if (!response.ok) {
      console.warn(`[kleros-address-tags] Scout request failed: ${response.status}`);
      return {};
    }

    return normalizeScoutResponse((await response.json()) as unknown, chainId);
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    console.warn('[kleros-address-tags] Scout request failed', error);
    return {};
  }
}
