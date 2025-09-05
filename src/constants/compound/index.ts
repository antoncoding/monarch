export type CompoundFeedEntry = {
  address: string
  base: string
  quote: string
  underlyingChainlinkFeed: string
}

const compoundFeeds: CompoundFeedEntry[] = [
  {
    address: '0x4F67e4d9BD67eFa28236013288737D39AeF48e79',
    base: 'wstETH',
    quote: 'ETH',
    underlyingChainlinkFeed: '0x86392dC19c0b719886221c78AB11eb8Cf5c52812',
  },
]

export function isCompoundFeed(address: string): boolean {
  return compoundFeeds.some(feed => feed.address.toLowerCase() === address.toLowerCase())
}

export function getCompoundFeed(address: string): CompoundFeedEntry | undefined {
  return compoundFeeds.find(feed => feed.address.toLowerCase() === address.toLowerCase())
}