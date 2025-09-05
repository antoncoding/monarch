import { Tooltip } from '@heroui/react'
import Image from 'next/image'
import { IoIosSwap } from 'react-icons/io'
import { IoWarningOutline } from 'react-icons/io5'
import { useMemo } from 'react'
import { Address } from 'viem'
import { getChainlinkOracle, isChainlinkOracle } from '@/constants/chainlink-data'
import { isCompoundFeed, getCompoundFeed } from '@/constants/compound'
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle'
import { OracleFeed } from '@/utils/types'
import { ChainlinkFeedTooltip } from './ChainlinkFeedTooltip'
import { CompoundFeedTooltip } from './CompoundFeedTooltip'
import { UnknownFeedTooltip } from './UnknownFeedTooltip'

type FeedEntryProps = {
  feed: OracleFeed | null
  chainId: number
}

export function FeedEntry({ feed, chainId }: FeedEntryProps): JSX.Element | null {
  if (!feed) return null

  const chainlinkFeedData = useMemo(() => {
    if (!feed?.address) return undefined
    return getChainlinkOracle(chainId, feed.address as Address)
  }, [chainId, feed.address])

  const compoundFeedData = useMemo(() => {
    if (!feed?.address) return undefined
    return getCompoundFeed(feed.address as Address)
  }, [feed.address])

  const truncateAsset = (asset: string) => asset.length > 5 ? asset.slice(0, 5) : asset
  
  // Determine asset names based on feed type
  const getAssetNames = () => {
    if (compoundFeedData) {
      return {
        fromAsset: truncateAsset(compoundFeedData.base),
        toAsset: truncateAsset(compoundFeedData.quote)
      }
    }
    return {
      fromAsset: truncateAsset(feed.pair?.[0] ?? chainlinkFeedData?.baseAsset ?? 'Unknown'),
      toAsset: truncateAsset(feed.pair?.[1] ?? chainlinkFeedData?.quoteAsset ?? 'Unknown')
    }
  }

  const { fromAsset, toAsset } = getAssetNames()

  const vendorIcon = OracleVendorIcons[feed.vendor as PriceFeedVendors]
  const isChainlink = isChainlinkOracle(chainId, feed.address as Address)
  const isCompound = isCompoundFeed(feed.address as Address)
  const isSVR = chainlinkFeedData?.isSVR ?? false

  const getTooltipContent = () => {
    if (isCompound && compoundFeedData) {
      return <CompoundFeedTooltip feed={feed} compoundData={compoundFeedData} chainId={chainId} />
    }
    
    if (isChainlink && chainlinkFeedData) {
      return <ChainlinkFeedTooltip feed={feed} chainlinkData={chainlinkFeedData} chainId={chainId} />
    }
    
    // Default fallback for unknown/unsupported feeds
    return <UnknownFeedTooltip feed={feed} chainId={chainId} />
  }

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none'
      }}
      content={getTooltipContent()}
    >
      <div className="flex w-full cursor-pointer items-center justify-between rounded-sm bg-hovered px-2 py-1 hover:bg-opacity-80">
        <div className="flex items-center gap-1">
          <span className="text-xs">{fromAsset}</span>
          <IoIosSwap className="text-xs text-gray-500" size={10} />
          <span className="text-xs">{toAsset}</span>
        </div>
        
        <div className="flex items-center gap-1">
          {isSVR && (
            <span className="rounded bg-orange-100 px-1 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              SVR
            </span>
          )}
          
          {(isChainlink || isCompound) && vendorIcon ? (
            <Image src={vendorIcon} alt={feed.vendor ?? 'Oracle'} width={12} height={12} />
          ) : (
            <IoWarningOutline size={12} className="text-yellow-500" />
          )}
        </div>
      </div>
    </Tooltip>
  )
}