import type { SupportedNetworks } from '@/utils/networks';

export type MarketDetailProvider = 'envio' | 'morpho-api' | 'subgraph';

type ProviderAttempt<T> = {
  provider: MarketDetailProvider;
  fetch: () => Promise<T | null>;
};

type RunMarketDetailFallbackParams<T> = {
  dataLabel: string;
  marketId: string;
  network: SupportedNetworks;
  attempts: ProviderAttempt<T>[];
};

type ProviderError = {
  provider: MarketDetailProvider;
  message: string;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
};

export const runMarketDetailFallback = async <T>({
  dataLabel,
  marketId,
  network,
  attempts,
}: RunMarketDetailFallbackParams<T>): Promise<T> => {
  const providerErrors: ProviderError[] = [];
  let lastProvider: MarketDetailProvider | null = null;
  let lastError: unknown = null;

  for (const attempt of attempts) {
    lastProvider = attempt.provider;

    try {
      const result = await attempt.fetch();
      if (result !== null) {
        return result;
      }

      const nullResultError = new Error(`${attempt.provider} returned null`);
      console.error(`Failed to fetch ${dataLabel} via ${attempt.provider}:`, nullResultError);
      providerErrors.push({
        provider: attempt.provider,
        message: nullResultError.message,
      });
      lastError = nullResultError;
    } catch (error) {
      console.error(`Failed to fetch ${dataLabel} via ${attempt.provider}:`, error);
      providerErrors.push({
        provider: attempt.provider,
        message: toErrorMessage(error),
      });
      lastError = error;
    }
  }

  const source = lastProvider ?? 'subgraph';
  const attemptedProviders = attempts.map((attempt) => attempt.provider);
  const message = `Failed to fetch ${dataLabel} for market ${marketId} on network ${network}: ${providerErrors
    .map(({ provider, message: providerMessage }) => `${provider}: ${providerMessage}`)
    .join('; ')}`;
  const normalizedError = new Error(message, {
    cause: lastError instanceof Error ? lastError : undefined,
  });

  throw Object.assign(normalizedError, {
    source,
    marketId,
    network,
    attemptedProviders,
    providerErrors,
  });
};
