import { type Address, isAddressEqual } from 'viem';

export const PENDLE_ROUTER_ADDRESS = '0x888888888889758F76e7103c6CbF23ABbF58F946' as Address;
export const PENDLE_LIMIT_ROUTER_ADDRESS = '0x000000000000c9B3E2C3Ec88B1B4c0cD853f4321' as Address;
export const PENDLE_API_BASE_URL = 'https://api-v2.pendle.finance/core';

// Pendle has versioned factories. Keep this list explicit and fail closed when a new
// version appears so an API response cannot substitute a look-alike market or PT.
const MARKET_FACTORIES: Readonly<Record<number, readonly Address[]>> = {
  1: [
    '0x27b1dAcd74688aF24a64BD3C9C1B143118740784',
    '0x1A6fCc85557BC4fB7B534ed835a03EF056552D52',
    '0x3d75Bd20C983edb5fD218A1b7e0024F1056c7A2F',
    '0x6fcf753f2C67b83f7B09746Bbc4FA0047b35D050',
    '0x6d247b1c044fA1E22e6B04fA9F71Baf99EB29A9f',
  ],
  10: [
    '0x17F100fB4bE2707675c6439468d38249DD993d58',
    '0x4A2B38b9cBd83c86F261a4d64c243795D4d44aBC',
    '0x73Be47237F12F36203823BAc9A4d80dC798B7015',
    '0x02Adf72d5D06a9C92136562Eb237C07696833a84',
    '0x95a937f7064C75C6Bc257160088C0a9D58cca333',
  ],
  143: ['0xA3cb62a49b66B2536cf6F3C7AC82293784888A3'],
  999: ['0x44A2DdF5339FfdE8c23AF4099a64Def59b11b128', '0xB5CD902CbEF8461b8d6fa852f93784F090fd7BEb'],
  8453: ['0x59968008a703dC13E6beaECed644bdCe4ee45d13', '0x81E80A50E56d10C501fF17B5Fe2F662bd9EA4590'],
  42161: [
    '0xf5a7De2D276dbda3EEf1b62A9E718EFf4d29dDC8',
    '0x2FCb47B58350cD377f94d3821e7373Df60bD9Ced',
    '0xd9f5e9589016da862D2aBcE980A5A5B99A94f3E8',
    '0xd29e76c6F15ada0150D10A1D3f45aCCD2098283B',
    '0x49F2f7002669E0e4425Fa0203975625Ab4af3143',
  ],
};

const YIELD_FACTORIES: Readonly<Record<number, readonly Address[]>> = {
  1: [
    '0x70ee0A6DB4F5a2Dc4d9c0b57bE97B9987e75BAFD',
    '0xdF3601014686674e53d1Fa52F7602525483F9122',
    '0x273b4bFA3Bb30fe8F32c467b5f0046834557F072',
    '0x35A338522a435D46f77Be32C70E215B813D0e3aC',
    '0x3E6EBa46AbC5ab18ED95F6667d8B2fd4020E4637',
  ],
  10: [
    '0xf5a7De2D276dbda3EEf1b62A9E718EFf4d29dDC8',
    '0xfa6B22FC4c3Ad88B68c16b3061a16b1714F6Bd57',
    '0xf799E4c029d14f41Dc1918C9A4C67242F565710e',
    '0xCcA0977eA3809C8fB785737Eb9fAcD5B19626e81',
    '0x2bA5e078b1fF6f1AB02a3B4462F3Be6E950E60e8',
  ],
  143: ['0x4fe1B23ab695D99394Ab78c16A5bE358f31847F4'],
  999: ['0x523eCB8501C14507bCa56d4752dA1991c6176758', '0x396797c8EBc52b734424001D2d8Eb32528FAE831'],
  8453: ['0x963ddBB35c1AE44e2a159E3b5fb5177E0B32660d', '0xdDBfA21ecf024971486684E4E1600998ADeabc88'],
  42161: [
    '0x28dE02Ac3c3F5ef427e55c321F73fDc7F192e8E4',
    '0xEb38531db128EcA928aea1B1CE9E5609B15ba146',
    '0xc7F8F9F1DdE1104664b6fC8F33E49b169C12F41E',
    '0xFF29e023910FB9bfc86729c1050AF193A45a0C0c',
    '0xBA814Bf6E27A6d6baE4a8aC65c8Bc3d8e9B0aaCF',
  ],
};

const includesAddress = (addresses: readonly Address[] | undefined, address: Address): boolean =>
  addresses?.some((candidate) => isAddressEqual(candidate, address)) ?? false;

export const isTrustedPendleMarketFactory = (chainId: number, factory: Address): boolean =>
  includesAddress(MARKET_FACTORIES[chainId], factory);

export const isTrustedPendleYieldContractFactory = (chainId: number, factory: Address): boolean =>
  includesAddress(YIELD_FACTORIES[chainId], factory);
