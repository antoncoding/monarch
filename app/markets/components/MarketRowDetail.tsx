import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { OracleFeedInfo } from '@/components/FeedInfo/OracleFeedInfo';
import { Info } from '@/components/Info/info';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { formatReadable } from '@/utils/balance';
import { getExplorerURL } from '@/utils/external';
import { Market } from '@/utils/types';

export function ExpandedMarketDetail({ market }: { market: Market }) {
  const oracleData = market.oracle.data;

  const hasFeeds =
    oracleData &&
    (oracleData.baseFeedOne ||
      oracleData.baseFeedTwo ||
      oracleData.quoteFeedOne ||
      oracleData.quoteFeedTwo);

  return (
    <div className="m-4 flex max-w-xs flex-col gap-2 sm:max-w-sm lg:max-w-none lg:flex-row">
      {/* Oracle info */}
      <div className="m-4 lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Oracle Info</p>
        </div>
        <div className="mb-1 flex items-start justify-between">
          <p className="font-inter text-sm opacity-80">Vendors:</p>
          <a
            className="group flex items-center gap-1 no-underline hover:underline"
            href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
            target="_blank"
          >
            <OracleVendorBadge oracleData={oracleData} useTooltip={false} />
            <ExternalLinkIcon />
          </a>
        </div>
        {hasFeeds && (
          <div className="mt-4">
            <p className="mb-2 text-left font-inter text-sm opacity-80">Feed Routes:</p>
            <OracleFeedInfo feed={oracleData.baseFeedOne} chainId={market.morphoBlue.chain.id} />
            <OracleFeedInfo feed={oracleData.baseFeedTwo} chainId={market.morphoBlue.chain.id} />
            <OracleFeedInfo feed={oracleData.quoteFeedOne} chainId={market.morphoBlue.chain.id} />
            <OracleFeedInfo feed={oracleData.quoteFeedTwo} chainId={market.morphoBlue.chain.id} />
          </div>
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
