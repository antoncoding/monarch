import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { zeroAddress } from 'viem';
import { OracleFeedInfo } from '@/components/FeedInfo/OracleFeedInfo';
import { Info } from '@/components/Info/info';
import { Market } from '@/hooks/useMarkets';
import { formatReadable } from '@/utils/balance';
import { getExplorerURL } from '@/utils/external';

export function ExpandedMarketDetail({ market }: { market: Market }) {
  console.log('market.oracleFeed', market.oracleFeed);

  return (
    <div className="m-4 flex max-w-xs flex-col gap-2 sm:max-w-sm lg:max-w-none lg:flex-row">
      {/* Oracle info */}
      <div className="m-4 lg:w-1/3">
        {/* warnings */}
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Oracle Info</p>
        </div>
        <div className="mb-1 flex items-start justify-between">
          <p className="font-inter text-sm opacity-80">Oracle:</p>
          <a
            className="group flex items-center gap-1 no-underline hover:underline"
            href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
            target="_blank"
          >
            <p className="text-right font-zen text-sm">{market.oracleInfo.type}</p>
            <ExternalLinkIcon />
          </a>
        </div>
        {market.oracleFeed && (
          <>
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-xs opacity-80">Base feed</p>

              <OracleFeedInfo
                address={market.oracleFeed.baseFeedOneAddress}
                title={market.oracleFeed.baseFeedOneDescription}
                chainId={market.morphoBlue.chain.id}
              />
            </div>
            {/* only shows base feed 2 if non-zero */}
            {market.oracleFeed.baseFeedTwoAddress !== zeroAddress && (
              <div className="mb-1 flex items-start justify-between">
                <p className="font-inter text-xs opacity-80">Base feed 2</p>
                <OracleFeedInfo
                  address={market.oracleFeed.baseFeedTwoAddress}
                  title={market.oracleFeed.baseFeedTwoDescription}
                  chainId={market.morphoBlue.chain.id}
                />
              </div>
            )}

            {market.oracleFeed.quoteFeedOneAddress !== zeroAddress && (
              <div className="mb-1 flex items-start justify-between">
                <p className="font-inter text-xs opacity-80">Quote feed</p>
                <OracleFeedInfo
                  address={market.oracleFeed.quoteFeedOneAddress}
                  title={market.oracleFeed.quoteFeedOneDescription}
                  chainId={market.morphoBlue.chain.id}
                />
              </div>
            )}

            {/* only shows quote feed 2 if non-zero */}
            {market.oracleFeed.quoteFeedTwoAddress !== zeroAddress && (
              <div className="mb-1 flex items-start justify-between">
                <p className="font-inter text-xs opacity-80">Quote feed 2</p>
                <OracleFeedInfo
                  address={market.oracleFeed.quoteFeedTwoAddress}
                  title={market.oracleFeed.quoteFeedTwoDescription}
                  chainId={market.morphoBlue.chain.id}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* market info */}
      <div className="m-4 lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Market State</p>
        </div>
        <div className="mb-1 flex items-start justify-between">
          <p className="font-inter text-sm opacity-80">Available Liquidity</p>
          <p className="text-right font-zen text-sm">
            {formatReadable(Number(market.state.liquidityAssetsUsd))}
          </p>
        </div>
        <div className="mb-1 flex items-start justify-between">
          <p className="font-inter text-sm opacity-80">Utilization Rate</p>
          <p className="text-right font-zen text-sm">
            {formatReadable(Number(market.state.utilization * 100))}%
          </p>
        </div>
      </div>

      {/* warnings */}
      <div className="m-4 mr-0 lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Warnings</p>
        </div>

        <div className="w-full gap-2 ">
          {market.warningsWithDetail.map((warning) => {
            return (
              <Info
                key={warning.code}
                description={warning.description}
                level={warning.level}
                title={' '}
              />
            );
          })}
        </div>
        {
          // if no warning
          market.warnings.length === 0 && (
            <Info description="No warning flagged for this market!" level="success" />
          )
        }
      </div>
    </div>
  );
}
