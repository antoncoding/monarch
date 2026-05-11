export type TrustedVault = {
  address: `0x${string}`;
  chainId: number;
  name: string;
  asset: `0x${string}`;
  featured?: boolean;
  metadataDescription?: string;
  metadataImage?: string;
  source?: 'monarch' | 'morpho';
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const known_vaults: TrustedVault[] = [
  {
    address: '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A',
    chainId: 8453,
    name: 'Spark USDC Vault',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0xd63070114470f685b75B74D60EEc7c1113d33a3D',
    chainId: 1,
    name: 'MEV Capital USDC',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    address: '0xdd0f28e19C1780eb6396170735D45153D261490d',
    chainId: 1,
    name: 'Gauntlet USDC Prime',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    address: '0x8CB3649114051cA5119141a34C200D65dc0Faa73',
    chainId: 1,
    name: 'Gauntlet USDT Prime',
    asset: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  {
    address: '0x2371e134e3455e0593363cBF89d3b6cf53740618',
    chainId: 1,
    name: 'Gauntlet WETH Prime',
    asset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  {
    address: '0x4Ff4186188f8406917293A9e01A1ca16d3cf9E59',
    chainId: 1,
    name: 'SwissBorg Morpho USDC',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    address: '0x781FB7F6d845E3bE129289833b04d43Aa8558c42',
    chainId: 137,
    name: 'Compound USDC',
    asset: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  },
  {
    address: '0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8',
    chainId: 137,
    name: 'Compound USDT',
    asset: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  {
    address: '0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF',
    chainId: 137,
    name: 'Compound WETH',
    asset: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  {
    address: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183',
    chainId: 8453,
    name: 'Steakhouse USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB',
    chainId: 1,
    name: 'Steakhouse USDC',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    address: '0xBEeFFF209270748ddd194831b3fa287a5386f5bC',
    chainId: 1,
    name: 'Smokehouse USDC',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    address: '0x5c0C306Aaa9F877de636f4d5822cA9F2E81563BA',
    chainId: 42_161,
    name: 'Steakhouse High Yield USDC',
    asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  {
    address: '0xCBeeF01994E24a60f7DCB8De98e75AD8BD4Ad60d',
    chainId: 8453,
    name: 'Steakhouse High Yield USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0xBEEFA7B88064FeEF0cEe02AAeBBd95D30df3878F',
    chainId: 8453,
    name: 'Steakhouse High Yield USDC v1.1',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0x6D4e530B8431a52FFDA4516BA4Aadc0951897F8C',
    chainId: 1,
    name: 'Steakhouse USDC RWA',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    address: '0xBEEf1f5Bd88285E5B239B6AAcb991d38ccA23Ac9',
    chainId: 1,
    name: 'Steakhouse infiniFi USDC',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  {
    address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2',
    chainId: 8453,
    name: 'Steakhouse Prime USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0x87DEAE530841A9671326C9D5B9f91bdB11F3162c',
    chainId: 42_161,
    name: 'Yearn OG USDC',
    asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  {
    address: '0xef417a2512C5a41f69AE4e021648b69a7CdE5D03',
    chainId: 8453,
    name: 'Yearn OG USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0x43e623Ff7D14d5b105F7bE9c488F36dbF11D1F46',
    chainId: 8453,
    name: 'Clearstar Boring USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca',
    chainId: 8453,
    name: 'Moonwell Flagship USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0xa0E430870c4604CcfC7B38Ca7845B1FF653D0ff1',
    chainId: 8453,
    name: 'Moonwell Flagship WETH',
    asset: '0x4200000000000000000000000000000000000006',
  },
  {
    address: '0x8A862fD6c12f9ad34C9c2ff45AB2b6712e8CEa27',
    chainId: 999,
    name: 'Felix USDC',
    asset: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
  },
  {
    address: '0xFc5126377F0efc0041C0969Ef9BA903Ce67d151e',
    chainId: 999,
    name: 'Felix USDT0',
    asset: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb',
  },
  {
    address: '0x2900ABd73631b2f60747e687095537B673c06A76',
    chainId: 999,
    name: 'Felix WHYPE',
    asset: '0x5555555555555555555555555555555555555555',
  },
];

export const getVaultKey = (address: string, chainId: number) => `${chainId}:${address.toLowerCase()}`;
