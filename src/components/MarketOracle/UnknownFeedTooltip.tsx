import Image from 'next/image'
import Link from 'next/link'
import { Address } from 'viem'
import { getExplorerURL } from '@/utils/external'
import { OracleVendors, OracleVendorIcons } from '@/utils/oracle'
import { OracleFeed } from '@/utils/types'
import { getSlicedAddress } from '@/utils/address'
import etherscanLogo from '@/imgs/etherscan.png'

type UnknownFeedTooltipProps = {
  feed: OracleFeed
  chainId: number
}

export function UnknownFeedTooltip({ feed, chainId }: UnknownFeedTooltipProps) {
  const baseAsset = feed.pair?.[0] ?? 'Unknown'
  const quoteAsset = feed.pair?.[1] ?? 'Unknown'
  
  const vendorIcon = OracleVendorIcons[feed.vendor as OracleVendors]
  
  return (
    <div className="flex rounded-sm p-4 max-w-md bg-surface border border-gray-200/20 dark:border-gray-600/15 shadow-sm">
      <div className="flex w-full flex-col gap-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          {vendorIcon ? (
            <div className="flex-shrink-0">
              <Image src={vendorIcon} alt={feed.vendor ?? 'Unknown'} width={16} height={16} />
            </div>
          ) : (
            <div className="flex-shrink-0 w-4 h-4 bg-gray-400 rounded-sm flex items-center justify-center">
              <span className="text-xs text-white font-bold">?</span>
            </div>
          )}
          <div className="font-zen font-bold">Oracle Feed Details</div>
        </div>

        {/* Feed pair name */}
        <div className="flex items-center gap-2">
          <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
            {baseAsset} / {quoteAsset}
          </div>
        </div>

        {/* Oracle Information */}
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Provider:</span>
            <span className="font-medium">{feed.vendor ?? 'Unknown'}</span>
          </div>
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Address:</span>
            <span className="font-medium font-mono text-xs">{getSlicedAddress(feed.address as Address)}</span>
          </div>
          {feed.description && (
            <div className="flex flex-col font-zen text-sm gap-1">
              <span className="text-gray-600 dark:text-gray-400">Description:</span>
              <span className="font-medium text-xs">{feed.description}</span>
            </div>
          )}
        </div>

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
          </div>
        </div>
      </div>
    </div>
  )
}