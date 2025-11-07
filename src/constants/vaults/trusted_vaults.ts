// Default fallback logo for unknown curators
export const DEFAULT_VAULT_LOGO = '/imgs/curators/unknown.svg';

export enum VaultCurator {
    Avantgarde = 'Avantgarde',
    Clearstar = 'Clearstar',
    Gauntlet = 'Gauntlet',
    Yearn = 'Yearn',
    MEVCapital = 'MEVCapital',
    BlockAnalitica = 'Block Analitica',
    Re7 = 'Re7',
    Relend = 'Relend',
    Spark = 'Spark',
    Steakhouse = 'Steakhouse',
  }

  // Logo path mapping for each vault curator
  export const VAULT_CURATOR_LOGOS: Record<VaultCurator, string> = {
    [VaultCurator.Avantgarde]: '/imgs/curators/avantgarde.svg',
    [VaultCurator.Clearstar]: '/imgs/curators/clearstar.svg',
    [VaultCurator.Gauntlet]: '/imgs/curators/gauntlet.svg',
    [VaultCurator.Yearn]: '/imgs/curators/yearn.svg',
    [VaultCurator.MEVCapital]: '/imgs/curators/mevcapital.png',
    [VaultCurator.BlockAnalitica]: '/imgs/curators/block-analitica.png',
    [VaultCurator.Re7]: '/imgs/curators/re7.png',
    [VaultCurator.Relend]: '/imgs/curators/relend.png',
    [VaultCurator.Spark]: '/imgs/curators/spark.svg',
    [VaultCurator.Steakhouse]: '/imgs/curators/steakhouse.svg',
  };

  export type TrustedVault = {
    address: string;
    curator: VaultCurator | string;
    chainId: number;
    name: string;
    asset: string;
  };

  // Helper function to safely get vault curator logo
  export function getVaultLogo(curator: VaultCurator | string): string {
    if (!curator || curator === 'unknown') {
      return DEFAULT_VAULT_LOGO;
    }
    const logo = VAULT_CURATOR_LOGOS[curator as VaultCurator];
    if (!logo) {
      console.warn(`[getVaultLogo] No logo found for curator "${curator}", using default logo`);
      return DEFAULT_VAULT_LOGO;
    }
    return logo;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  export const trusted_vaults: TrustedVault[] = [
    { address: '0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A', curator: VaultCurator.Spark, chainId: 8453, name: 'Spark USDC Vault', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0xe41a0583334f0dc4E023Acd0bFef3667F6FE0597', curator: VaultCurator.Spark, chainId: 1, name: 'Spark USDS Vault', asset: '0xdC035D45d973E3EC169d2276DDab16f1e407384F' },
    { address: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB', curator: VaultCurator.Steakhouse, chainId: 1, name: 'Steakhouse USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183', curator: VaultCurator.Steakhouse, chainId: 8453, name: 'Steakhouse USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0xdd0f28e19C1780eb6396170735D45153D261490d', curator: VaultCurator.Gauntlet, chainId: 1, name: 'Gauntlet USDC Prime', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0xd63070114470f685b75B74D60EEc7c1113d33a3D', curator: VaultCurator.MEVCapital, chainId: 1, name: 'MEV Capital USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458', curator: VaultCurator.Gauntlet, chainId: 1, name: 'Gauntlet USDC Core', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x7e97fa6893871A2751B5fE961978DCCb2c201E65', curator: VaultCurator.Gauntlet, chainId: 42161, name: 'Gauntlet USDC Core', asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { address: '0x64A651D825FC70Ebba88f2E1BAD90be9A496C4b9', curator: VaultCurator.Avantgarde, chainId: 42161, name: 'Avantgarde USDC Core Arbitrum', asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { address: '0x62fE596d59fB077c2Df736dF212E0AFfb522dC78', curator: VaultCurator.Clearstar, chainId: 1, name: 'Clearstar USDC Reactor', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x616a4E1db48e22028f6bbf20444Cd3b8e3273738', curator: VaultCurator.Gauntlet, chainId: 8453, name: 'Seamless USDC Vault', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0xBEefb9f61CC44895d8AEc381373555a64191A9c4', curator: VaultCurator.Steakhouse, chainId: 1, name: 'Vault Bridge USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0xBEeFFF209270748ddd194831b3fa287a5386f5bC', curator: VaultCurator.Steakhouse, chainId: 1, name: 'Smokehouse USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0xC0c5689e6f4D256E861F65465b691aeEcC0dEb12', curator: VaultCurator.Gauntlet, chainId: 8453, name: 'Gauntlet USDC Core', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0x5c0C306Aaa9F877de636f4d5822cA9F2E81563BA', curator: VaultCurator.Steakhouse, chainId: 42161, name: 'Steakhouse High Yield USDC', asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { address: '0xCBeeF01994E24a60f7DCB8De98e75AD8BD4Ad60d', curator: VaultCurator.Steakhouse, chainId: 8453, name: 'Steakhouse High Yield USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0xBEEFA7B88064FeEF0cEe02AAeBBd95D30df3878F', curator: VaultCurator.Steakhouse, chainId: 8453, name: 'Steakhouse High Yield USDC v1.1', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0x236919F11ff9eA9550A4287696C2FC9e18E6e890', curator: VaultCurator.Gauntlet, chainId: 8453, name: 'Gauntlet USDC Frontier', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0x8CB3649114051cA5119141a34C200D65dc0Faa73', curator: VaultCurator.Gauntlet, chainId: 1, name: 'Gauntlet USDT Prime', asset: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { address: '0x6D4e530B8431a52FFDA4516BA4Aadc0951897F8C', curator: VaultCurator.Steakhouse, chainId: 1, name: 'Steakhouse USDC RWA', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x5b56F90340dBAa6a8693DADb141D620f0e154fE6', curator: VaultCurator.Avantgarde, chainId: 1, name: 'Avantgarde USDC Core', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0xBEEf1f5Bd88285E5B239B6AAcb991d38ccA23Ac9', curator: VaultCurator.Steakhouse, chainId: 1, name: 'Steakhouse infiniFi USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x4Ff4186188f8406917293A9e01A1ca16d3cf9E59', curator: VaultCurator.Gauntlet, chainId: 1, name: 'SwissBorg Morpho USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x60d715515d4411f7F43e4206dc5d4a3677f0eC78', curator: VaultCurator.Re7, chainId: 1, name: 'Re7 USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x64964E162Aa18d32f91eA5B24a09529f811AEB8e', curator: VaultCurator.Re7, chainId: 1, name: 'Re7 USDC Prime', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0xBEEFE94c8aD530842bfE7d8B397938fFc1cb83b2', curator: VaultCurator.Steakhouse, chainId: 8453, name: 'Steakhouse Prime USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    
    { address: '0x87DEAE530841A9671326C9D5B9f91bdB11F3162c', curator: VaultCurator.Yearn, chainId: 42161, name: 'Yearn OG USDC', asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { address: '0x36b69949d60d06ECcC14DE0Ae63f4E00cc2cd8B9', curator: VaultCurator.Yearn, chainId: 42161, name: 'Yearn Degen USDC', asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    
    { address: '0x12AFDeFb2237a5963e7BAb3e2D46ad0eee70406e', curator: VaultCurator.Re7, chainId: 8453, name: 'Re7 USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0x1D3b1Cd0a0f242d598834b3F2d126dC6bd774657', curator: VaultCurator.Clearstar, chainId: 8453, name: 'Clearstar USDC Reactor', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0xCd347c1e7d600a9A3e403497562eDd0A7Bc3Ef21', curator: VaultCurator.Clearstar, chainId: 8453, name: 'High Yield Clearstar USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca', curator: VaultCurator.BlockAnalitica, chainId: 8453, name: 'Moonwell Flagship USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0xef417a2512C5a41f69AE4e021648b69a7CdE5D03', curator: VaultCurator.Yearn, chainId: 8453, name: 'Yearn OG USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }, // add Yearn to enum if you keep these
    { address: '0x43e623Ff7D14d5b105F7bE9c488F36dbF11D1F46', curator: VaultCurator.Clearstar, chainId: 8453, name: 'Clearstar Boring USDC', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { address: '0x0F359FD18BDa75e9c49bC027E7da59a4b01BF32a', curator: VaultCurator.Relend, chainId: 1, name: 'Relend USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { address: '0x132E6C9C33A62D7727cd359b1f51e5B566E485Eb', curator: VaultCurator.Gauntlet, chainId: 1, name: 'Resolv USDC', asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  ];