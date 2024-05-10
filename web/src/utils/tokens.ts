export type ERC20Token = {
  address: string;
  symbol: string;
  img: string | undefined;
  decimals: number;
};

const USDC: ERC20Token = {
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  symbol: 'USDC',
  img: require('../imgs/tokens/usdc.webp') as string,
  decimals: 6,
};

const USDT: ERC20Token = {
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  symbol: 'USDT',
  img: require('../imgs/tokens/usdt.webp') as string,
  decimals: 6,
};

const USDA: ERC20Token = {
  address: '0x0000206329b97DB379d5E1Bf586BbDB969C63274',
  symbol: 'USDA',
  img: require('../imgs/tokens/usda.png') as string,
  decimals: 6,
};

const frax: ERC20Token = {
  address: '0x853d955acef822db058eb8505911ed77f175b99e',
  symbol: 'FRAX',
  img: require('../imgs/tokens/frax.webp') as string,
  decimals: 18,
};

const PYUSD: ERC20Token = {
  address: '0x6c3ea9036406852006290770bedfcaba0e23a0e8',
  symbol: 'PYUSD',
  img: require('../imgs/tokens/pyusd.png') as string,
  decimals: 6,
};

const EURe: ERC20Token = {
  address: '0x3231Cb76718CDeF2155FC47b5286d82e6eDA273f',
  symbol: 'EURe',
  img: require('../imgs/tokens/eure.png') as string,
  decimals: 18,
};

const crvUSD: ERC20Token = {
  address: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E',
  symbol: 'crvUSD',
  img: require('../imgs/tokens/crvusd.png') as string,
  decimals: 18,
};

const USDe: ERC20Token = {
  address: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3',
  symbol: 'USDe',
  img: require('../imgs/tokens/usde.png') as string,
  decimals: 18,
};

const sUSDe: ERC20Token = {
  address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
  symbol: 'sUSDe',
  img: require('../imgs/tokens/susde.png') as string,
  decimals: 18,
};

const WETH: ERC20Token = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  symbol: 'WETH',
  img: require('../imgs/tokens/weth.webp') as string,
  decimals: 18,
};

const sDAI: ERC20Token = {
  address: '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
  symbol: 'sDAI',
  img: require('../imgs/tokens/sdai.svg') as string,
  decimals: 18,
};

const wstETH: ERC20Token = {
  address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
  symbol: 'wstETH',
  img: require('../imgs/tokens/wsteth.webp') as string,
  decimals: 18,
};

const DAI: ERC20Token = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  symbol: 'DAI',
  img: require('../imgs/tokens/dai.webp') as string,
  decimals: 18,
};

const gtWETH: ERC20Token = {
  address: '0x2371e134e3455e0593363cBF89d3b6cf53740618',
  symbol: 'gtWETH',
  img: undefined,
  decimals: 18,
};

const XPC: ERC20Token = {
  address: '0xCE8e559Ac89c2bDC97Bdb5F58705c54dB9cB77dC',
  symbol: 'XPC',
  img: undefined,
  decimals: 6,
};

const osETH: ERC20Token = {
  address: '0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38',
  symbol: 'osETH',
  img: require('../imgs/tokens/oseth.png') as string,
  decimals: 18,
};

const WBTC: ERC20Token = {
  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  symbol: 'WBTC',
  img: require('../imgs/tokens/wbtc.png') as string,
  decimals: 8,
};

const rsETH: ERC20Token = {
  address: '0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7',
  symbol: 'rsETH',
  img: require('../imgs/tokens/rseth.png') as string,
  decimals: 18,
};

const MKR: ERC20Token = {
  address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
  symbol: 'MKR',
  img: require('../imgs/tokens/mkr.webp') as string,
  decimals: 18,
};

const weETH: ERC20Token = {
  address: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
  symbol: 'weETH',
  img: require('../imgs/tokens/weeth.webp') as string,
  decimals: 18,
};

const apxETH: ERC20Token = {
  address: '0x9Ba021B0a9b958B5E75cE9f6dff97C7eE52cb3E6',
  symbol: 'apxETH',
  img: require('../imgs/tokens/apxeth.png') as string,
  decimals: 18,
};

const LDO: ERC20Token = {
  address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
  symbol: 'LDO',
  img: require('../imgs/tokens/ldo.webp') as string,
  decimals: 18,
};

const rETH: ERC20Token = {
  address: '0xae78736Cd615f374D3085123A210448E74Fc6393',
  symbol: 'rETH',
  img: require('../imgs/tokens/reth.webp') as string,
  decimals: 18,
};

const ezETH: ERC20Token = {
  address: '0xbf5495Efe5DB9ce00f80364C8B423567e58d2110',
  symbol: 'ezETH',
  img: require('../imgs/tokens/ezeth.webp') as string,
  decimals: 18,
};

const stEUR: ERC20Token = {
  address: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
  symbol: 'stEUR',
  img: require('../imgs/tokens/steur.png') as string,
  decimals: 18,
};

const supportedTokens: ERC20Token[] = [
  USDC,
  USDT,
  USDA,
  PYUSD,
  crvUSD,
  frax,
  EURe,
  USDe,
  sUSDe,
  WETH,
  sDAI,
  wstETH,
  DAI,
  gtWETH,
  XPC,
  osETH,
  WBTC,
  rsETH,
  MKR,
  weETH,
  apxETH,
  LDO,
  rETH,
  ezETH,
  stEUR,
];

export { supportedTokens };
