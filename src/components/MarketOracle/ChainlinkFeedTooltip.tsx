import Image from 'next/image'
import Link from 'next/link'
import { Address } from 'viem'
import { getExplorerURL } from '@/utils/external'
import { OracleVendors, OracleVendorIcons } from '@/utils/oracle'
import { OracleFeed } from '@/utils/types'
import { ChainlinkOracleEntry, getChainlinkFeedUrl } from '@/constants/chainlink-data'
import { Badge } from '@/components/common/Badge'
import etherscanLogo from '@/imgs/etherscan.png'

type ChainlinkFeedTooltipProps = {
  feed: OracleFeed
  chainlinkData?: ChainlinkOracleEntry
  chainId: number
}

export function ChainlinkFeedTooltip({ feed, chainlinkData, chainId }: ChainlinkFeedTooltipProps) {
  const baseAsset = feed.pair?.[0] ?? chainlinkData?.baseAsset ?? 'Unknown'
  const quoteAsset = feed.pair?.[1] ?? chainlinkData?.quoteAsset ?? 'Unknown'
  
  const vendorIcon = OracleVendorIcons[OracleVendors.Chainlink]
  
  // Generate Chainlink feed URL if we have the chainlink data
  const chainlinkUrl = chainlinkData ? getChainlinkFeedUrl(chainId, {
    ens: chainlinkData.ens,
    contractAddress: chainlinkData.contractAddress,
    contractVersion: chainlinkData.contractVersion,
    heartbeat: chainlinkData.heartbeat,
    multiply: chainlinkData.multiply,
    name: chainlinkData.name,
    path: chainlinkData.path,
    proxyAddress: chainlinkData.proxyAddress,
    threshold: chainlinkData.threshold,
    valuePrefix: chainlinkData.valuePrefix,
    assetName: chainlinkData.assetName,
    feedCategory: chainlinkData.feedCategory,
    feedType: chainlinkData.feedType,
    decimals: chainlinkData.decimals,
    docs: {
      baseAsset: chainlinkData.baseAsset,
      quoteAsset: chainlinkData.quoteAsset,
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
    <div className="flex rounded-sm p-4 max-w-md bg-surface border border-gray-200/20 dark:border-gray-600/15 shadow-sm">
      <div className="flex w-full flex-col gap-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          {vendorIcon && (
            <div className="flex-shrink-0">
              <Image src={vendorIcon} alt="Chainlink" width={16} height={16} />
            </div>
          )}
          <div className="font-zen font-bold">Chainlink Feed Details</div>
        </div>

        {/* Feed pair name with SVR badge if applicable */}
        <div className="flex items-center gap-2">
          <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
            {baseAsset} / {quoteAsset}
          </div>
          {chainlinkData?.isSVR && (
            <Badge variant="warning" size="sm">
              SVR
            </Badge>
          )}
        </div>

        {/* Chainlink Specific Data */}
        {chainlinkData && (
          <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
              <span className="font-medium">{chainlinkData.heartbeat}s</span>
            </div>
            <div className="flex justify-between font-zen text-sm items-center">
              <span className="text-gray-600 dark:text-gray-400">Risk Tier:</span>
              {getRiskTierBadge(chainlinkData.feedCategory)}
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
              <span className="font-medium">{(chainlinkData.threshold).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* External Links */}
        <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="font-zen text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            View on:
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={getExplorerURL(feed.address as Address, chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-sm bg-hovered px-3 py-2 text-xs font-medium text-primary hover:bg-opacity-80 transition-all duration-200 no-underline"
            >
              <Image src={etherscanLogo} alt="Etherscan" width={12} height={12} className="rounded-sm" />
              Etherscan
            </Link>
            {chainlinkUrl && (
              <Link
                href={chainlinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-sm bg-hovered px-3 py-2 text-xs font-medium text-primary hover:bg-opacity-80 transition-all duration-200 no-underline"
              >
                {vendorIcon && <Image src={vendorIcon} alt="Chainlink" width={12} height={12} />}
                Chainlink
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}