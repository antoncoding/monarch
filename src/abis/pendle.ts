import { parseAbi } from 'viem';

export const pendlePtAbi = parseAbi([
  'function SY() view returns (address)',
  'function YT() view returns (address)',
  'function factory() view returns (address)',
  'function expiry() view returns (uint256)',
]);

export const pendleYtAbi = parseAbi(['function PT() view returns (address)']);

export const pendleSyAbi = parseAbi([
  'function yieldToken() view returns (address)',
  'function assetInfo() view returns (uint8 assetType, address assetAddress, uint8 assetDecimals)',
  'function getTokensIn() view returns (address[])',
  'function getTokensOut() view returns (address[])',
]);

export const pendleMarketAbi = parseAbi([
  'function readTokens() view returns (address SY, address PT, address YT)',
  'function factory() view returns (address)',
]);

export const pendleMarketFactoryAbi = parseAbi(['function isValidMarket(address market) view returns (bool)']);

export const pendleYieldContractFactoryAbi = parseAbi([
  'function isPT(address) view returns (bool)',
  'function isYT(address) view returns (bool)',
  'function getPT(address SY, uint256 expiry) view returns (address)',
  'function getYT(address SY, uint256 expiry) view returns (address)',
]);

export const pendleRouterAbi = parseAbi([
  'struct SwapData { uint8 swapType; address extRouter; bytes extCalldata; bool needScale; }',
  'struct Order { uint256 salt; uint256 expiry; uint256 nonce; uint8 orderType; address token; address YT; address maker; address receiver; uint256 makingAmount; uint256 lnImpliedRate; uint256 failSafeRate; bytes permit; }',
  'struct FillOrderParams { Order order; bytes signature; uint256 makingAmount; }',
  'struct LimitOrderData { address limitRouter; uint256 epsSkipMarket; FillOrderParams[] normalFills; FillOrderParams[] flashFills; bytes optData; }',
  'struct ApproxParams { uint256 guessMin; uint256 guessMax; uint256 guessOffchain; uint256 maxIteration; uint256 eps; }',
  'struct TokenInput { address tokenIn; uint256 netTokenIn; address tokenMintSy; address pendleSwap; SwapData swapData; }',
  'struct TokenOutput { address tokenOut; uint256 minTokenOut; address tokenRedeemSy; address pendleSwap; SwapData swapData; }',
  'function swapExactTokenForPt(address receiver, address market, uint256 minPtOut, ApproxParams guessPtOut, TokenInput input, LimitOrderData limit) payable returns (uint256 netPtOut, uint256 netSyFee, uint256 netSyInterm)',
  'function swapExactPtForToken(address receiver, address market, uint256 exactPtIn, TokenOutput output, LimitOrderData limit) returns (uint256 netTokenOut, uint256 netSyFee, uint256 netSyInterm)',
  'function redeemPyToToken(address receiver, address YT, uint256 netPyIn, TokenOutput output) returns (uint256 netTokenOut, uint256 netSyInterm)',
]);
