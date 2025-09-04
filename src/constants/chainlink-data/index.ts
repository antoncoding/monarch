import { ChainlinkOracleEntry } from './types'
import mainnetRawData from './mainnet.json'
import baseRawData from './base.json'
import polygonRawData from './polygon.json'
import { isSupportedChain, SupportedNetworks } from '@/utils/networks'

type RawOracleEntry = {
  contractAddress: string
  contractVersion: number
  ens: string
  heartbeat: number
  multiply: string
  name: string
  path: string
  proxyAddress: string
  threshold: number
  valuePrefix: string
  assetName: string
  feedCategory: 'low' | 'medium' | 'high' | 'custom'
  feedType: string
  decimals: number
  docs: {
    baseAsset?: string
    quoteAsset?: string
    [key: string]: any
  }
  [key: string]: any
}

const transformOracleData = (rawData: RawOracleEntry[]): ChainlinkOracleEntry[] => {
  return rawData.map((entry) => ({
    contractAddress: entry.contractAddress,
    contractVersion: entry.contractVersion,
    ens: entry.ens,
    heartbeat: entry.heartbeat,
    multiply: entry.multiply,
    name: entry.name,
    path: entry.path,
    proxyAddress: entry.proxyAddress ?? '',
    threshold: entry.threshold,
    valuePrefix: entry.valuePrefix,
    assetName: entry.assetName,
    feedCategory: entry.feedCategory,
    feedType: entry.feedType,
    decimals: entry.decimals,
    baseAsset: entry.docs?.baseAsset ?? '',
    quoteAsset: entry.docs?.quoteAsset ?? '',
    isSVR: entry.path.endsWith('-svr'),
  }))
}

export const CHAINLINK_ORACLES = {
  [SupportedNetworks.Mainnet]: transformOracleData(mainnetRawData as RawOracleEntry[]),
  [SupportedNetworks.Base]: transformOracleData(baseRawData as RawOracleEntry[]),
  [SupportedNetworks.Polygon]: transformOracleData(polygonRawData as RawOracleEntry[]),
  [SupportedNetworks.Unichain]: [] as ChainlinkOracleEntry[],
} as const

export const getAllOracles = (): Record<SupportedNetworks, ChainlinkOracleEntry[]> => CHAINLINK_ORACLES

export const getOracleByPath = (
  chain: keyof typeof CHAINLINK_ORACLES,
  path: string
): ChainlinkOracleEntry | undefined => {
  return CHAINLINK_ORACLES[chain].find((oracle) => oracle.path === path)
}

export const isChainlinkOracle = (chainId: number, address: string): boolean => {
  if (!isSupportedChain(chainId) || !address) return false
  const network = chainId as SupportedNetworks
  return CHAINLINK_ORACLES[network].some((oracle) => oracle.proxyAddress.toLowerCase() === address.toLowerCase())
}

export const getChainlinkOracle = (chainId: number, address: string): ChainlinkOracleEntry | undefined => {
    if (!isSupportedChain(chainId) || !address) return undefined
  const network = chainId as SupportedNetworks
  return CHAINLINK_ORACLES[network].find((oracle) => oracle.proxyAddress.toLowerCase() === address.toLowerCase())  
}

export const getChainlinkFeedUrl = (chainId: number, rawOracleEntry: RawOracleEntry): string => {
  if (chainId === SupportedNetworks.Mainnet) {
    return `https://data.chain.link/feeds/ethereum/mainnet/${rawOracleEntry.ens}`
  }
  if (chainId === SupportedNetworks.Base) {
    return `https://data.chain.link/feeds/base/base/${rawOracleEntry.ens}`
  }
  if (chainId === SupportedNetworks.Polygon) {
    return `https://data.chain.link/feeds/polygon/mainnet/${rawOracleEntry.ens}`
  }
  return ''
}

export * from './types'