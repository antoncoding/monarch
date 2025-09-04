import Image from 'next/image'
import Link from 'next/link'
import { ExternalLinkIcon } from '@radix-ui/react-icons'
import { Address } from 'viem'
import { getSlicedAddress } from '@/utils/address'
import { getExplorerURL } from '@/utils/external'
import { OracleVendors, OracleVendorIcons } from '@/utils/oracle'
import { OracleFeed } from '@/utils/types'
import { ChainlinkOracleEntry, getChainlinkFeedUrl } from '@/constants/chainlink-data'

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

  return (
    <div className="flex rounded-sm p-4 opacity-80 max-w-sm">
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

        {/* Feed info */}
        <div>
          <div className="font-zen text-sm text-gray-600 dark:text-gray-400">
            {baseAsset} / {quoteAsset}
          </div>
        </div>

        {/* Address */}
        <div>
          <div className="font-zen text-sm font-medium text-gray-700 dark:text-gray-300">Address:</div>
          <Link
            href={getExplorerURL(feed.address as Address, chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-zen text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {getSlicedAddress(feed.address as Address)}
            <ExternalLinkIcon className="h-3 w-3" />
          </Link>
        </div>

        {/* Chainlink Specific Data */}
        {chainlinkData && (
          <div className="space-y-2 border-t border-gray-200 pt-2 dark:border-gray-700">
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
              <span className="font-medium">{chainlinkData.heartbeat}s</span>
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Category:</span>
              <span className="font-medium capitalize">{chainlinkData.feedCategory}</span>
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Threshold:</span>
              <span className="font-medium">{(chainlinkData.threshold * 100).toFixed(1)}%</span>
            </div>
            {chainlinkData.isSVR && (
              <div className="flex items-center justify-between font-zen text-sm">
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  SVR Feed
                </span>
              </div>
            )}
          </div>
        )}

        {/* Chainlink Feed Link */}
        {chainlinkUrl && (
          <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
            <Link
              href={chainlinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-zen text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View on Chainlink
              <ExternalLinkIcon className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}