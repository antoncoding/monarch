export type GeneralPriceFeed = {
  chainId: number;
  address: string;
  vendor: string;
  description: string;
  pair: [string, string];
  decimals: number;
  tokenIn?: {
    address: string;
    chainId: number;
  };
  tokenOut?: {
    address: string;
    chainId: number;
  };
};
