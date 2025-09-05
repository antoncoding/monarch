import Image from 'next/image'
import Link from 'next/link'
import { Address } from 'viem'
import { getExplorerURL } from '@/utils/external'
import { OracleVendors, OracleVendorIcons } from '@/utils/oracle'
import { OracleFeed } from '@/utils/types'
import { CompoundFeedEntry } from '@/constants/compound'
import { ChainlinkOracleEntry, getChainlinkFeedUrl, getChainlinkOracle } from '@/constants/chainlink-data'
import { Badge } from '@/components/common/Badge'
import { useMemo } from 'react'
import etherscanLogo from '@/imgs/etherscan.png'

type CompoundFeedTooltipProps = {
  feed: OracleFeed
  compoundData: CompoundFeedEntry
  chainId: number
}

export function CompoundFeedTooltip({ feed, compoundData, chainId }: CompoundFeedTooltipProps) {
  const baseAsset = compoundData.base
  const quoteAsset = compoundData.quote
  
  const compoundLogo = OracleVendorIcons[OracleVendors.Compound]
  const chainlinkLogo = OracleVendorIcons[OracleVendors.Chainlink]
  
  // Get the underlying Chainlink feed data
  const underlyingChainlinkData = useMemo(() => {
    return getChainlinkOracle(chainId, compoundData.underlyingChainlinkFeed as Address)
  }, [chainId, compoundData.underlyingChainlinkFeed])

  // Generate Chainlink feed URL if we have the underlying chainlink data
  const chainlinkUrl = underlyingChainlinkData ? getChainlinkFeedUrl(chainId, {
    ens: underlyingChainlinkData.ens,
    contractAddress: underlyingChainlinkData.contractAddress,
    contractVersion: underlyingChainlinkData.contractVersion,
    heartbeat: underlyingChainlinkData.heartbeat,
    multiply: underlyingChainlinkData.multiply,
    name: underlyingChainlinkData.name,
    path: underlyingChainlinkData.path,
    proxyAddress: underlyingChainlinkData.proxyAddress,
    threshold: underlyingChainlinkData.threshold,
    valuePrefix: underlyingChainlinkData.valuePrefix,
    assetName: underlyingChainlinkData.assetName,
    feedCategory: underlyingChainlinkData.feedCategory,
    feedType: underlyingChainlinkData.feedType,
    decimals: underlyingChainlinkData.decimals,
    docs: {
      baseAsset: underlyingChainlinkData.baseAsset,
      quoteAsset: underlyingChainlinkData.quoteAsset,
    }
  }) : ''

  // Risk tier badge using Badge component
  const getRiskTierBadge = (category: string) => {
    const variantMap = {
      low: 'success' as const,
      medium: 'warning' as const, 
      high: 'danger' as const,
      custom: 'primary' as const
    }
    
    const variant = variantMap[category as keyof typeof variantMap] || 'primary'
    
    return (
      <Badge variant={variant} size="sm">
        {category.toUpperCase()} RISK
      </Badge>
    )
  }

  return (
    <div className="flex rounded-sm p-4 max-w-xs bg-surface border border-gray-200/20 dark:border-gray-600/15 shadow-sm">
      <div className="flex w-full flex-col gap-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          {compoundLogo && (
            <div className="flex-shrink-0">
              <Image src={compoundLogo} alt="Compound" width={16} height={16} />
            </div>
          )}
          <div className="font-zen font-bold">Compound Feed Details</div>
        </div>

        {/* Feed pair name */}
        <div className="flex items-center gap-2">
          <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
            {baseAsset} / {quoteAsset}
          </div>
        </div>

        {/* Compound-specific description */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-sm p-3 border border-blue-200/30 dark:border-blue-600/20">
          <div className="font-zen text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
            Compound Wrapper Feed
          </div>
          <div className="font-zen text-xs text-blue-700 dark:text-blue-400">
            This feed converts {underlyingChainlinkData?.baseAsset ?? 'Unknown'} / {underlyingChainlinkData?.quoteAsset ?? 'Unknown'} to {baseAsset} / {quoteAsset} using Compound's conversion logic.
          </div>
        </div>

        {/* Underlying Chainlink Data */}
        {underlyingChainlinkData && (
          <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
            <div className="flex items-center gap-2 mb-2">
              {chainlinkLogo && <Image src={chainlinkLogo} alt="Chainlink" width={12} height={12} />}
              <span className="font-zen text-sm font-medium text-gray-700 dark:text-gray-300">
                Underlying Chainlink Feed
              </span>
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
              <span className="font-medium">{underlyingChainlinkData.heartbeat}s</span>
            </div>
            <div className="flex justify-between font-zen text-sm items-center">
              <span className="text-gray-600 dark:text-gray-400">Risk Tier:</span>
              {getRiskTierBadge(underlyingChainlinkData.feedCategory)}
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
              <span className="font-medium">{(underlyingChainlinkData.threshold).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* External Links */}
        <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="font-zen text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            View on:
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={getExplorerURL(feed.address as Address, chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-sm bg-hovered px-3 py-2 text-xs font-medium text-primary hover:bg-opacity-80 transition-all duration-200 no-underline"
            >
              <Image src={etherscanLogo} alt="Etherscan" width={12} height={12} className="rounded-sm" />
              Compound Feed
            </Link>
            <Link
              href={getExplorerURL(compoundData.underlyingChainlinkFeed as Address, chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-sm bg-hovered px-3 py-2 text-xs font-medium text-primary hover:bg-opacity-80 transition-all duration-200 no-underline"
            >
              <Image src={etherscanLogo} alt="Etherscan" width={12} height={12} className="rounded-sm" />
              Underlying Feed
            </Link>
            {chainlinkUrl && (
              <Link
                href={chainlinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-sm bg-hovered px-3 py-2 text-xs font-medium text-primary hover:bg-opacity-80 transition-all duration-200 no-underline"
              >
                {chainlinkLogo && <Image src={chainlinkLogo} alt="Chainlink" width={12} height={12} />}
                Chainlink
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}