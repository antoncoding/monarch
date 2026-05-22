export type TrustedVault = {
  address: `0x${string}`;
  chainId: number;
  name: string;
  asset: `0x${string}`;
  featured?: boolean;
  metadataDescription?: string;
  metadataImage?: string;
  version?: 'v1' | 'v2';
};

export const getVaultKey = (address: string, chainId: number) => `${chainId}:${address.toLowerCase()}`;

const withDefaultVersion = (vault: TrustedVault): TrustedVault => ({
  ...vault,
  version: vault.version ?? 'v1',
});

const rawKnownVaults: TrustedVault[] = [
  {
    address: '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A',
    chainId: 8453,
    name: 'Spark USDC Vault',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
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
    address: '0x8c106EEDAd96553e64287A5A6839c3Cc78afA3D0',
    chainId: 1,
    name: 'Gauntlet USDC Prime',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    version: 'v2',
  },
  {
    address: '0x610D151aE40662AE148cdBaaE1Ea5904b6AFAE78',
    chainId: 42_161,
    name: 'Gauntlet USDC Prime',
    asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    version: 'v2',
  },
  // Wintermute Prime
  {
    address: '0x5dc53a23AdC9f2Bed98de6F59F7F309a7c71FF2B',
    chainId: 1,
    name: 'Wintermute USDC Prime',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    version: 'v2',
  },
  {
    address: '0x4Ef53d2cAa51C447fdFEEedee8F07FD1962C9ee6',
    chainId: 1,
    name: 'KPK USDC Prime',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    version: 'v2',
  },
  {
    address: '0xe479bCbc98579bA3E1a1261f7bE85C4C10303d88',
    chainId: 1,
    name: 'Sentora PYUSD Core V2',
    asset: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    version: 'v2',
  },
  {
    address: '0xC21b08C16458202593D4D9B26b9984Ee67b38BbD',
    chainId: 1,
    name: 'Sentora PRIME Main',
    asset: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    version: 'v2',
  },
  {
    address: '0x6dC58a0FdfC8D694e571DC59B9A52EEEa780E6bf',
    chainId: 1,
    name: 'Sentora RLUSD Main',
    asset: '0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD',
    version: 'v2',
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
    address: '0x5c0C306Aaa9F877de636f4d5822cA9F2E81563BA',
    chainId: 42_161,
    name: 'Steakhouse High Yield USDC',
    asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  {
    address: '0xBEEFA7B88064FeEF0cEe02AAeBBd95D30df3878F',
    chainId: 8453,
    name: 'Steakhouse High Yield USDC v1.1',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2',
    chainId: 8453,
    name: 'Steakhouse Prime USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    address: '0xbeef088055857739C12CD3765F20b7679Def0f51',
    chainId: 1,
    name: 'Steakhouse Prime USDC',
    asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    version: 'v2',
  },
  {
    address: '0xbeef003C68896c7D2c3c60d363e8d71a49Ab2bf9',
    chainId: 1,
    name: 'Steakhouse Prime USDT',
    asset: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    version: 'v2',
  },
  {
    address: '0x43e623Ff7D14d5b105F7bE9c488F36dbF11D1F46',
    chainId: 8453,
    name: 'Clearstar Boring USDC',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
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

// eslint-disable-next-line @typescript-eslint/naming-convention
export const known_vaults: TrustedVault[] = rawKnownVaults.map(withDefaultVersion);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const monarch_suggested_vaults: TrustedVault[] = known_vaults;
