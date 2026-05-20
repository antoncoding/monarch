import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getKlerosAddressTagKey,
  normalizeKlerosAddress,
  normalizeKlerosAddressList,
  type KlerosAddressTag,
  type KlerosAddressTagsByKey,
} from '@/data-sources/kleros/address-tags';

const KLEROS_SCOUT_ADDRESS_TAGS_URL = 'https://scout-api.kleros.link/api/address-tags';
const MAX_ADDRESSES_PER_REQUEST = 50;
const CACHE_CONTROL = 'public, s-maxage=21600, stale-while-revalidate=86400';

const AddressTagsRequestSchema = z.object({
  addresses: z.array(z.string()).max(MAX_ADDRESSES_PER_REQUEST),
  chainId: z.number().int().positive(),
});

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

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedBody = AddressTagsRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: `Expected numeric chainId and up to ${MAX_ADDRESSES_PER_REQUEST} addresses` },
      { status: 400 },
    );
  }

  const { addresses, chainId } = parsedBody.data;
  const normalizedAddresses = normalizeKlerosAddressList(addresses).slice(0, MAX_ADDRESSES_PER_REQUEST);

  if (normalizedAddresses.length === 0) {
    return NextResponse.json({ tags: {} }, { headers: { 'Cache-Control': CACHE_CONTROL } });
  }

  try {
    const response = await fetch(KLEROS_SCOUT_ADDRESS_TAGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: normalizedAddresses,
        chains: [String(chainId)],
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(`[kleros-address-tags] Scout request failed: ${response.status}`);
      return NextResponse.json({ tags: {} }, { headers: { 'Cache-Control': CACHE_CONTROL } });
    }

    const scoutResponse = (await response.json()) as unknown;
    return NextResponse.json(
      { tags: normalizeScoutResponse(scoutResponse, chainId) },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (error) {
    console.warn('[kleros-address-tags] Scout request failed', error);
    return NextResponse.json({ tags: {} }, { headers: { 'Cache-Control': CACHE_CONTROL } });
  }
}
