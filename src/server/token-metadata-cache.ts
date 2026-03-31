import 'server-only';

import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import {
  resolveUnknownTokenInfosOnchain,
  serializeResolvedTokenInfos,
  type SerializedResolvedTokenInfos,
  type TokenAddressInput,
} from '@/utils/tokenMetadata';
import { infoToKey } from '@/utils/tokens';

const TOKEN_METADATA_REVALIDATE_SECONDS = 24 * 60 * 60;

const normalizeTokenInputs = (tokens: TokenAddressInput[]): TokenAddressInput[] => {
  const deduped = new Map<string, TokenAddressInput>();

  for (const token of tokens) {
    const normalized = {
      address: token.address.toLowerCase(),
      chainId: token.chainId,
    };
    const key = infoToKey(normalized.address, normalized.chainId);

    if (!deduped.has(key)) {
      deduped.set(key, normalized);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => left.chainId - right.chainId || left.address.localeCompare(right.address));
};

const buildTokenSignature = (tokens: TokenAddressInput[]): string => createHash('sha256').update(JSON.stringify(tokens)).digest('hex');

export const fetchCachedUnknownTokenInfos = async (tokens: TokenAddressInput[]): Promise<SerializedResolvedTokenInfos> => {
  if (tokens.length === 0) {
    return {};
  }

  const normalizedTokens = normalizeTokenInputs(tokens);
  const signature = buildTokenSignature(normalizedTokens);

  const getCachedTokenInfos = unstable_cache(
    async () => {
      const resolvedTokenInfos = await resolveUnknownTokenInfosOnchain(normalizedTokens);
      return serializeResolvedTokenInfos(resolvedTokenInfos);
    },
    ['token-metadata', signature],
    {
      revalidate: TOKEN_METADATA_REVALIDATE_SECONDS,
    },
  );

  return getCachedTokenInfos();
};
