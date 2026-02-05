import { TokenPeg } from '@/utils/tokens';

export type MajorPrices = {
  [TokenPeg.ETH]?: number;
  [TokenPeg.BTC]?: number;
};

// CoinGecko API endpoint (ETH/BTC reference prices)
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd';

type CoinGeckoPriceResponse = {
  bitcoin?: { usd?: number };
  ethereum?: { usd?: number };
};

const priceCache: { data?: MajorPrices; ts?: number; inflight?: Promise<MajorPrices> } = {};

export const fetchMajorPrices = async (): Promise<MajorPrices> => {
  if (priceCache.data && Date.now() - (priceCache.ts ?? 0) < 60_000) {
    return priceCache.data;
  }

  if (priceCache.inflight) {
    return priceCache.inflight;
  }

  priceCache.inflight = (async () => {
    try {
      const response = await fetch(COINGECKO_API_URL);
      if (!response.ok) {
        throw new Error(`CoinGecko request failed with status ${response.status}`);
      }

      const data = (await response.json()) as CoinGeckoPriceResponse;
      const prices: MajorPrices = {
        [TokenPeg.BTC]: data.bitcoin?.usd,
        [TokenPeg.ETH]: data.ethereum?.usd,
      };

      const result = Object.entries(prices).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key as keyof MajorPrices] = value;
        }
        return acc;
      }, {} as MajorPrices);

      priceCache.data = result;
      priceCache.ts = Date.now();
      return result;
    } catch (error) {
      console.error('Failed to fetch major token prices from CoinGecko:', error);
      return {};
    } finally {
      priceCache.inflight = undefined;
    }
  })();

  return priceCache.inflight;
};
