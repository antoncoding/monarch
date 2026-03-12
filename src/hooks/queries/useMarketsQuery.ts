import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarkets } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain } from '@/utils/networks';
import type { Market } from '@/utils/types';

type MarketFetchSource = 'morpho-api' | 'subgraph';

type NetworkFetchTrace = {
  network: number;
  source: MarketFetchSource | null;
  markets: number;
  totalDurationMs: number;
  morphoDurationMs: number | null;
  subgraphDurationMs: number | null;
  fallbackReason: string | null;
  failed: boolean;
  errorMessage: string | null;
};

type FailedNetworkFetch = {
  error: unknown;
  trace: NetworkFetchTrace;
};

const now = (): number => globalThis.performance?.now() ?? Date.now();

const roundDuration = (durationMs: number | null): number | null => {
  if (durationMs == null) return null;
  return Number(durationMs.toFixed(1));
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const shouldLogMarketsPerf = process.env.NODE_ENV !== 'production';

/**
 * Fetches markets from all supported networks using React Query.
 *
 * Data fetching strategy:
 * - Tries Morpho API first (if supported)
 * - Falls back to Subgraph if API fails
 * - Combines markets from all networks
 * - Applies basic filtering (required fields, supported chains)
 *
 * Cache behavior:
 * - staleTime: 5 minutes (data considered fresh)
 * - Auto-refetch: Every 5 minutes in background
 * - Refetch on window focus: enabled
 *
 * @example
 * ```tsx
 * const { data: markets, isLoading, isRefetching, refetch } = useMarketsQuery();
 * ```
 */
export const useMarketsQuery = () => {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const fetchStartedAt = now();
      const fetchLabel = `markets-${Math.round(fetchStartedAt)}`;

      try {
        const combinedMarkets: Market[] = [];
        const fetchErrors: unknown[] = [];

        // Fetch markets for each network based on its data source.
        // Use allSettled so a single chain failure cannot reject the whole query.
        const results = await Promise.allSettled(
          ALL_SUPPORTED_NETWORKS.map(async (network) => {
            const networkStartedAt = now();
            let networkMarkets: Market[] = [];
            let trySubgraph = !supportsMorphoApi(network);
            let source: MarketFetchSource | null = null;
            let morphoDurationMs: number | null = null;
            let subgraphDurationMs: number | null = null;
            let fallbackReason: string | null = null;

            try {
              // Try Morpho API first if supported
              if (!trySubgraph) {
                const morphoStartedAt = now();
                try {
                  if (shouldLogMarketsPerf) {
                    console.info(`[markets][${fetchLabel}] network ${network}: trying Morpho API`);
                  }
                  networkMarkets = await fetchMorphoMarkets(network);
                  morphoDurationMs = now() - morphoStartedAt;
                  source = 'morpho-api';
                } catch (morphoError) {
                  morphoDurationMs = now() - morphoStartedAt;
                  trySubgraph = true;
                  fallbackReason = getErrorMessage(morphoError);
                  console.error(`Failed to fetch markets via Morpho API for ${network}:`, morphoError);
                  // Continue to Subgraph fallback
                }
              }

              // If Morpho API failed or not supported, try Subgraph
              if (trySubgraph) {
                const subgraphStartedAt = now();
                try {
                  if (shouldLogMarketsPerf) {
                    console.info(
                      `[markets][${fetchLabel}] network ${network}: trying Subgraph`,
                      fallbackReason ? { fallbackReason } : undefined,
                    );
                  }
                  networkMarkets = await fetchSubgraphMarkets(network);
                  subgraphDurationMs = now() - subgraphStartedAt;
                  source = 'subgraph';
                  console.log(`Fetched ${networkMarkets.length} markets via Subgraph for ${network}`);
                } catch (subgraphError) {
                  subgraphDurationMs = now() - subgraphStartedAt;
                  console.error(`Failed to fetch markets via Subgraph for ${network}:`, subgraphError);
                  throw subgraphError;
                }
              }

              const trace: NetworkFetchTrace = {
                network,
                source,
                markets: networkMarkets.length,
                totalDurationMs: now() - networkStartedAt,
                morphoDurationMs,
                subgraphDurationMs,
                fallbackReason,
                failed: false,
                errorMessage: null,
              };

              if (shouldLogMarketsPerf) {
                console.info(`[markets][${fetchLabel}] network ${network}: completed`, {
                  source: trace.source,
                  markets: trace.markets,
                  totalDurationMs: roundDuration(trace.totalDurationMs),
                  morphoDurationMs: roundDuration(trace.morphoDurationMs),
                  subgraphDurationMs: roundDuration(trace.subgraphDurationMs),
                  fallbackReason: trace.fallbackReason,
                });
              }

              return {
                networkMarkets,
                trace,
              };
            } catch (error) {
              const trace: NetworkFetchTrace = {
                network,
                source,
                markets: networkMarkets.length,
                totalDurationMs: now() - networkStartedAt,
                morphoDurationMs,
                subgraphDurationMs,
                fallbackReason,
                failed: true,
                errorMessage: getErrorMessage(error),
              };

              if (shouldLogMarketsPerf) {
                console.warn(`[markets][${fetchLabel}] network ${network}: failed`, {
                  totalDurationMs: roundDuration(trace.totalDurationMs),
                  morphoDurationMs: roundDuration(trace.morphoDurationMs),
                  subgraphDurationMs: roundDuration(trace.subgraphDurationMs),
                  fallbackReason: trace.fallbackReason,
                  errorMessage: trace.errorMessage,
                });
              }

              const failedFetch: FailedNetworkFetch = {
                error,
                trace,
              };

              throw failedFetch;
            }
          }),
        );

        const traces: NetworkFetchTrace[] = [];

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            combinedMarkets.push(...result.value.networkMarkets);
            traces.push(result.value.trace);
          } else {
            const network = ALL_SUPPORTED_NETWORKS[index];
            const failedResult = result.reason as FailedNetworkFetch | undefined;
            traces.push({
              network,
              source: failedResult?.trace.source ?? null,
              markets: failedResult?.trace.markets ?? 0,
              totalDurationMs: failedResult?.trace.totalDurationMs ?? 0,
              morphoDurationMs: failedResult?.trace.morphoDurationMs ?? null,
              subgraphDurationMs: failedResult?.trace.subgraphDurationMs ?? null,
              fallbackReason: failedResult?.trace.fallbackReason ?? null,
              failed: true,
              errorMessage: failedResult?.trace.errorMessage ?? getErrorMessage(result.reason),
            });
            console.error(`Failed to fetch markets for network ${network}:`, failedResult?.error ?? result.reason);
            fetchErrors.push(failedResult?.error ?? result.reason);
          }
        });

        // Apply basic filtering
        const filtered = combinedMarkets
          .filter((market) => market.uniqueKey !== undefined)
          .filter((market) => market.loanAsset && market.collateralAsset)
          .filter((market) => isSupportedChain(market.morphoBlue.chain.id));

        // If any network fetch failed, log but still return what we got
        if (fetchErrors.length > 0) {
          console.warn(`Failed to fetch markets from ${fetchErrors.length} network(s)`, fetchErrors[0]);
        }

        // If everything failed, surface an error so the UI can react.
        if (filtered.length === 0 && fetchErrors.length > 0) {
          throw fetchErrors[0];
        }

        if (shouldLogMarketsPerf) {
          console.groupCollapsed(
            `[markets][${fetchLabel}] fetch complete in ${roundDuration(now() - fetchStartedAt)}ms (${filtered.length} filtered markets)`,
          );
          console.table(
            traces.map((trace) => ({
              network: trace.network,
              source: trace.source ?? 'failed',
              markets: trace.markets,
              totalDurationMs: roundDuration(trace.totalDurationMs),
              morphoDurationMs: roundDuration(trace.morphoDurationMs),
              subgraphDurationMs: roundDuration(trace.subgraphDurationMs),
              fallbackReason: trace.fallbackReason,
              errorMessage: trace.errorMessage,
            })),
          );
          console.info(`[markets][${fetchLabel}] summary`, {
            rawMarkets: combinedMarkets.length,
            filteredMarkets: filtered.length,
            failedNetworks: fetchErrors.length,
          });
          console.groupEnd();
        }

        return filtered;
      } catch (err) {
        console.error('Overall error fetching markets:', err);
        throw err; // React Query will handle error state
      }
    },
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
