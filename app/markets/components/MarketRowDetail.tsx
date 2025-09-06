import { Info } from '@/components/Info/info';
import { OracleTypeInfo } from '@/components/MarketOracle';
import { useMarketWarnings } from '@/hooks/useMarketWarnings';
import { formatReadable } from '@/utils/balance';
import { Market } from '@/utils/types';

export function ExpandedMarketDetail({ market }: { market: Market }) {
  const oracleData = market.oracle ? market.oracle.data : null;
  const warningsWithDetail = useMarketWarnings(market, true);

  return (
    <div className="m-4 flex max-w-xs flex-col gap-2 sm:max-w-sm lg:max-w-none lg:flex-row">
      <div className="m-4 lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base">
          <p className="mb-2 font-zen">Oracle Info</p>
        </div>

        {/* contains: Oracle Info:    Standard (Custom...etc) */}
        <OracleTypeInfo
          oracleData={oracleData}
          oracleAddress={market.oracleAddress}
          chainId={market.morphoBlue.chain.id}
          showLink
          showCustom={false}
        />
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
          {warningsWithDetail.map((warning) => {
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
          warningsWithDetail.length === 0 && (
            <Info description="No warning flagged for this market!" level="success" />
          )
        }
      </div>
    </div>
  );
}
