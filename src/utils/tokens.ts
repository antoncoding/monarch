import { Chain, base, mainnet } from 'viem/chains';

export type ERC20Token = {
  symbol: string;
  img: string | undefined;
  decimals: number;
  networks: { chain: Chain; address: string }[];
  protocol?: {
    name: string;
    isProxy: boolean;
  };
};

export type UnknownERC20Token = {
  symbol: string;
  img: undefined;
  decimals: number;
  networks: { chain: Chain; address: string }[];
  isUnknown?: boolean;
};

const MORPHO_TOKEN_BASE = '0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842';
const MORPHO_TOKEN_MAINNET = '0x58D97B57BB95320F9a05dC918Aef65434969c2B2';
const MORPHO_LEGACY = '0x9994E35Db50125E0DF82e4c2dde62496CE330999';

// wrapper to convert legacy morpho tokens
const MORPHO_TOKEN_WRAPPER = '0x9d03bb2092270648d7480049d0e58d2fcf0e5123';

const supportedTokens = [
  {
    symbol: 'USDC',
    img: require('../imgs/tokens/usdc.webp') as string,
    decimals: 6,
    networks: [
      { chain: mainnet, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
      { chain: base, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    ],
  },
  {
    symbol: 'USDT',
    img: require('../imgs/tokens/usdt.webp') as string,
    decimals: 6,
    networks: [{ chain: mainnet, address: '0xdac17f958d2ee523a2206206994597c13d831ec7' }],
  },
  {
    symbol: 'eUSD',
    img: require('../imgs/tokens/eusd.svg') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0xA0d69E286B938e21CBf7E51D71F6A4c8918f482F' },
      { chain: base, address: '0xCfA3Ef56d303AE4fAabA0592388F19d7C3399FB4' },
    ],
    protocol: {
      name: 'Reserve',
      isProxy: true,
    },
  },
  {
    symbol: 'USDA',
    img: require('../imgs/tokens/usda.png') as string,
    decimals: 6,
    networks: [{ chain: mainnet, address: '0x0000206329b97DB379d5E1Bf586BbDB969C63274' }],
  },
  {
    symbol: 'USD0',
    img: require('../imgs/tokens/usd0.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5' }],
  },
  {
    symbol: 'USD0++',
    img: require('../imgs/tokens/usd0pp.svg') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x35D8949372D46B7a3D5A56006AE77B215fc69bC0' }],
    protocol: {
      name: 'Usual',
      isProxy: true,
    },
  },
  {
    symbol: 'hyUSD',
    img: require('../imgs/tokens/hyusd.svg') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0xCc7FF230365bD730eE4B352cC2492CEdAC49383e' }],
    protocol: {
      name: 'Resolve',
      isProxy: true,
    },
  },
  {
    symbol: 'crvUSD',
    img: require('../imgs/tokens/crvusd.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E' }],
  },
  {
    symbol: 'USDe',
    img: require('../imgs/tokens/usde.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3' }],
  },
  {
    symbol: 'sUSDe',
    img: require('../imgs/tokens/susde.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497' }],
  },
  {
    symbol: 'FRAX',
    img: require('../imgs/tokens/frax.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x853d955acef822db058eb8505911ed77f175b99e' }],
  },
  {
    symbol: 'PYUSD',
    img: require('../imgs/tokens/pyusd.png') as string,
    decimals: 6,
    networks: [{ chain: mainnet, address: '0x6c3ea9036406852006290770bedfcaba0e23a0e8' }],
  },
  {
    symbol: 'aUSD',
    img: require('../imgs/tokens/aUSD.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a' }],
    protocol: {
      name: 'Agora',
      isProxy: true,
    },
  },
  {
    symbol: 'wUSDM',
    img: require('../imgs/tokens/wusdm.png') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812' },
      { chain: base, address: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812' },
    ],
  },
  {
    symbol: 'EURe',
    img: require('../imgs/tokens/eure.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x3231Cb76718CDeF2155FC47b5286d82e6eDA273f' }],
  },
  {
    symbol: 'EURC',
    img: require('../imgs/tokens/eurc.png') as string,
    decimals: 6,
    networks: [
      { chain: mainnet, address: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c' },
      { chain: base, address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42' },
    ],
  },
  {
    symbol: 'WETH',
    img: require('../imgs/tokens/weth.webp') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
      { chain: base, address: '0x4200000000000000000000000000000000000006' },
    ],
  },
  {
    symbol: 'sDAI',
    img: require('../imgs/tokens/sdai.svg') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x83F20F44975D03b1b09e64809B757c47f942BEeA' }],
  },
  {
    symbol: 'wstETH',
    img: require('../imgs/tokens/wsteth.webp') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' },
      { chain: base, address: '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452' },
    ],
  },
  {
    symbol: 'cbETH',
    img: require('../imgs/tokens/cbeth.png') as string,
    decimals: 18,
    networks: [{ address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', chain: base }],
  },
  {
    symbol: 'DAI',
    img: require('../imgs/tokens/dai.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' }],
  },
  {
    symbol: 'gtWETH',
    img: undefined,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x2371e134e3455e0593363cBF89d3b6cf53740618' }],
  },
  {
    symbol: 'XPC',
    img: undefined,
    decimals: 6,
    networks: [{ chain: mainnet, address: '0xCE8e559Ac89c2bDC97Bdb5F58705c54dB9cB77dC' }],
  },
  {
    symbol: 'osETH',
    img: require('../imgs/tokens/oseth.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38' }],
  },
  {
    symbol: 'WBTC',
    img: require('../imgs/tokens/wbtc.png') as string,
    decimals: 8,
    networks: [{ chain: mainnet, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' }],
  },
  {
    symbol: 'cbBTC',
    img: require('../imgs/tokens/cbbtc.webp') as string,
    decimals: 8,
    networks: [
      { chain: mainnet, address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' },
      { chain: base, address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' },
    ],
  },
  {
    symbol: 'tBTC',
    img: require('../imgs/tokens/tbtc.webp') as string,
    decimals: 8,
    networks: [{ chain: mainnet, address: '0x18084fbA666a33d37592fA2633fD49a74DD93a88' }],
  },
  {
    symbol: 'lBTC',
    img: require('../imgs/tokens/lbtc.webp') as string,
    decimals: 8,
    networks: [
      { chain: mainnet, address: '0x8236a87084f8B84306f72007F36F2618A5634494' },
      { chain: base, address: '0xecAc9C5F704e954931349Da37F60E39f515c11c1' },
    ],
  },
  {
    symbol: 'rsETH',
    img: require('../imgs/tokens/rseth.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7' }],
  },
  {
    symbol: 'MKR',
    img: require('../imgs/tokens/mkr.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2' }],
  },
  {
    symbol: 'weETH',
    img: require('../imgs/tokens/weeth.webp') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee' },
      { chain: base, address: '0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A' },
    ],
  },
  {
    symbol: 'apxETH',
    img: require('../imgs/tokens/apxeth.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x9Ba021B0a9b958B5E75cE9f6dff97C7eE52cb3E6' }],
  },
  {
    symbol: 'bsdETH',
    img: require('../imgs/tokens/bsdETH.svg') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0xCb327b99fF831bF8223cCEd12B1338FF3aA322Ff' }],
    protocol: {
      name: 'Reserve',
      isProxy: true,
    },
  },
  {
    symbol: 'ETH+',
    img: require('../imgs/tokens/eth+.svg') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xE72B141DF173b999AE7c1aDcbF60Cc9833Ce56a8' }],
    protocol: {
      name: 'Reserve',
      isProxy: true,
    },
  },
  {
    symbol: 'LDO',
    img: require('../imgs/tokens/ldo.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32' }],
  },
  {
    symbol: 'rETH',
    img: require('../imgs/tokens/reth.webp') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0xae78736Cd615f374D3085123A210448E74Fc6393' },
      { chain: base, address: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c' },
    ],
  },
  {
    symbol: 'ezETH',
    img: require('../imgs/tokens/ezeth.webp') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0xbf5495Efe5DB9ce00f80364C8B423567e58d2110' },
      {
        chain: base,
        address: '0x2416092f143378750bb29b79eD961ab195CcEea5',
      },
    ],
  },
  {
    symbol: 'stEUR',
    img: require('../imgs/tokens/steur.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x004626A008B1aCdC4c74ab51644093b155e59A23' }],
  },
  {
    symbol: 'CRV',
    img: require('../imgs/tokens/crv.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xD533a949740bb3306d119CC777fa900bA034cd52' }],
  },
  {
    symbol: 'DEGEN',
    img: require('../imgs/tokens/degen.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed' }],
  },
  {
    symbol: 'LINK',
    img: require('../imgs/tokens/link.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' }],
  },
  {
    symbol: 'USYC',
    img: require('../imgs/tokens/usyc.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b' }],
  },
  {
    symbol: 'USDz',
    img: require('../imgs/tokens/usdz.png') as string,
    decimals: 18,
    networks: [
      { chain: mainnet, address: '0xA469B7Ee9ee773642b3e93E842e5D9b5BaA10067' },
      { chain: base, address: '0x04D5ddf5f3a8939889F11E97f8c4BB48317F1938' },
    ],
  },
  {
    symbol: 'pufETH',
    img: require('../imgs/tokens/pufETH.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xD9A442856C234a39a81a089C06451EBAa4306a72' }],
  },
  {
    symbol: 'rswETH',
    img: require('../imgs/tokens/rsweth.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xFAe103DC9cf190eD75350761e95403b7b8aFa6c0' }],
  },
  {
    symbol: 'UNI',
    img: require('../imgs/tokens/uni.webp') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' }],
  },
  {
    symbol: 'AERO',
    img: require('../imgs/tokens/AERO.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' }],
  },
  {
    // Resolv
    symbol: 'RLP',
    img: require('../imgs/tokens/rlp.svg') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x4956b52aE2fF65D74CA2d61207523288e4528f96' }],
  },
  {
    // Resolv
    symbol: 'USR',
    img: require('../imgs/tokens/usr.svg') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0x66a1E37c9b0eAddca17d3662D6c05F4DECf3e110' }],
  },
  {
    symbol: 'EIGEN',
    img: require('../imgs/tokens/eigen.png') as string,
    decimals: 18,
    networks: [{ chain: mainnet, address: '0xec53bF9167f50cDEB3Ae105f56099aaaB9061F83' }],
  },
  {
    symbol: 'wsuperOETHb',
    img: require('../imgs/tokens/wsuperOETHb.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0x7FcD174E80f264448ebeE8c88a7C4476AAF58Ea6' }],
  },
  {
    symbol: 'uSOL',
    img: require('../imgs/tokens/usol.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0x9B8Df6E244526ab5F6e6400d331DB28C8fdDdb55' }],
  },
  {
    symbol: 'uSui',
    img: require('../imgs/tokens/usui.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0xb0505e5a99abd03d94a1169e638B78EDfEd26ea4' }],
  },
  // rewards
  {
    symbol: 'WELL',
    img: require('../imgs/tokens/well.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0xA88594D404727625A9437C3f886C7643872296AE' }],
  },
  {
    symbol: 'ION',
    img: require('../imgs/tokens/ionic.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0x3eE5e23eEE121094f1cFc0Ccc79d6C809Ebd22e5' }],
  },
  {
    symbol: 'PYTH',
    img: require('../imgs/oracles/pyth.png') as string,
    decimals: 18,
    networks: [{ chain: base, address: '0x4c5d8A75F3762c1561D96f177694f67378705E98' }],
  },
  {
    symbol: 'MORPHO',
    img: require('../imgs/tokens/morpho.svg') as string,
    decimals: 18,
    networks: [
      {
        address: MORPHO_TOKEN_MAINNET,
        chain: mainnet,
      },
      {
        address: MORPHO_TOKEN_BASE,
        chain: base,
      },
    ],
  },
  {
    symbol: 'MORPHO*',
    img: require('../imgs/tokens/morpho.svg') as string,
    decimals: 18,
    networks: [
      {
        address: MORPHO_LEGACY,
        chain: mainnet,
      },
    ],
  },
];

const isWhitelisted = (address: string, chainId: number) => {
  return supportedTokens.some((token) =>
    token.networks.some(
      (network) =>
        network.address.toLowerCase() === address.toLowerCase() && network.chain.id === chainId,
    ),
  );
};

const findToken = (address: string, chainId: number) => {
  return supportedTokens.find((token) =>
    token.networks.some(
      (network) =>
        network.address.toLowerCase() === address.toLowerCase() && network.chain.id === chainId,
    ),
  );
};

const infoToKey = (address: string, chainId: number) => {
  return `${address.toLowerCase()}-${chainId}`;
};

const findTokenWithKey = (key: string) => {
  // key: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48-1|0x833589fcd6edb6e08f4c7c32d4f71b54bda02913-8453'
  const subKeys = key.split('|');
  return supportedTokens.find((token) => {
    return token.networks.some(
      (network) => infoToKey(network.address, network.chain.id) === subKeys[0].toLowerCase(),
    );
  });
};

const getUniqueTokens = (tokenList: { address: string; chainId: number }[]) => {
  return supportedTokens.filter((token) => {
    return tokenList.find((item) =>
      token.networks.find(
        (network) =>
          network.address.toLowerCase() === item.address.toLowerCase() &&
          network.chain.id === item.chainId,
      ),
    );
  });
};

export {
  supportedTokens,
  isWhitelisted,
  findTokenWithKey,
  findToken,
  getUniqueTokens,
  infoToKey,
  MORPHO_TOKEN_BASE,
  MORPHO_TOKEN_MAINNET,
  MORPHO_LEGACY,
  MORPHO_TOKEN_WRAPPER,
};
