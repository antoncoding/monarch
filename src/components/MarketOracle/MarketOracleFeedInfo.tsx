import { OracleFeed } from '@/utils/types'
import { FeedEntry } from './FeedEntry'

type MarketOracleFeedInfoProps = {
  baseFeedOne: OracleFeed | null | undefined
  baseFeedTwo: OracleFeed | null | undefined
  quoteFeedOne: OracleFeed | null | undefined
  quoteFeedTwo: OracleFeed | null | undefined
  chainId: number
}

export function MarketOracleFeedInfo({
  baseFeedOne,
  baseFeedTwo,
  quoteFeedOne,
  quoteFeedTwo,
  chainId,
}: MarketOracleFeedInfoProps): JSX.Element {
  const hasAnyFeed = baseFeedOne || baseFeedTwo || quoteFeedOne || quoteFeedTwo

  if (!hasAnyFeed) {
    return (
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        No feed routes available
      </div>
    )
  }

  const EmptyFeedSlot = () => (
    <div className="flex w-full cursor-default items-center gap-1 rounded-sm bg-gray-100 px-2 py-1 opacity-30 dark:bg-gray-800">
      <span className="text-xs text-gray-400">--</span>
    </div>
  )

  const renderFeed = (feed: OracleFeed | null | undefined) => 
    feed ? (
      <div className="w-full">
        <FeedEntry feed={feed} chainId={chainId} />
      </div>
    ) : (
      <EmptyFeedSlot />
    )

  return (
    <div className="space-y-2">
      {(baseFeedOne || baseFeedTwo) && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Base Feeds:</span>
          <div className="flex gap-2">
            <div className="w-28">{renderFeed(baseFeedOne)}</div>
            <div className="w-28">{renderFeed(baseFeedTwo)}</div>
          </div>
        </div>
      )}
      
      {(quoteFeedOne || quoteFeedTwo) && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Quote Feeds:</span>
          <div className="flex gap-2">
            <div className="w-28">{renderFeed(quoteFeedOne)}</div>
            <div className="w-28">{renderFeed(quoteFeedTwo)}</div>
          </div>
        </div>
      )}
    </div>
  )
}