import React from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { findToken } from '@/utils/tokens';
import { MarketPosition } from '@/utils/types';
import { GroupedPosition } from './PositionsSummaryTable';

type SuppliedMarketsDetailProps = {
  groupedPosition: GroupedPosition;
  setShowModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
};

export function SuppliedMarketsDetail({
  groupedPosition,
  setShowModal,
  setSelectedPosition,
}: SuppliedMarketsDetailProps) {
  // Sort markets by supplied size (descending order)
  const sortedMarkets = [...groupedPosition.markets].sort(
    (a, b) =>
      Number(formatBalance(b.supplyAssets, b.market.loanAsset.decimals)) -
      Number(formatBalance(a.supplyAssets, a.market.loanAsset.decimals)),
  );

  const totalSupply = groupedPosition.totalSupply;

  return (
    <div className="bg-gray-50 px-2 py-4">
      <table className="no-hover-effect w-full font-zen">
        <thead className="table-header">
          <tr>
            <th>Market ID</th>
            <th>Collateral</th>
            <th>LLTV</th>
            <th>APY</th>
            <th>Supplied</th>
            <th>% of Market</th>
            <th>% of My Supply</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody className="table-body text-sm">
          {sortedMarkets.map((position) => {
            const suppliedAmount = Number(
              formatBalance(position.supplyAssets, position.market.loanAsset.decimals),
            );
            const percentageOfMySupply = (suppliedAmount / totalSupply) * 100;

            return (
              <tr key={position.market.uniqueKey}>
                <td data-label="Market ID" className="text-center">
                  <a
                    className="group flex items-center justify-center gap-1 no-underline hover:underline"
                    href={getMarketURL(
                      position.market.uniqueKey,
                      position.market.morphoBlue.chain.id,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {position.market.uniqueKey.slice(2, 8)}
                    <ExternalLinkIcon className="opacity-0 group-hover:opacity-100" />
                  </a>
                </td>
                <td data-label="Collateral" className="text-center">
                  {position.market.collateralAsset ? (
                    <div className="flex items-center justify-center gap-1">
                      {position.market.collateralAsset.symbol}
                      {findToken(
                        position.market.collateralAsset.address,
                        position.market.morphoBlue.chain.id,
                      )?.img && (
                        <Image
                          src={
                            findToken(
                              position.market.collateralAsset.address,
                              position.market.morphoBlue.chain.id,
                            )?.img ?? ''
                          }
                          alt={position.market.collateralAsset.symbol}
                          width={18}
                          height={18}
                        />
                      )}
                    </div>
                  ) : (
                    'N/A'
                  )}
                </td>
                <td data-label="LLTV" className="text-center">
                  {formatBalance(position.market.lltv, 16)}%
                </td>
                <td data-label="APY" className="text-center">
                  {formatReadable(position.market.dailyApys.netSupplyApy * 100)}%
                </td>
                <td data-label="Supplied" className="text-center">
                  {formatReadable(suppliedAmount)} {position.market.loanAsset.symbol}
                </td>
                <td data-label="% of Market" className="text-center">
                  {formatReadable(
                    (Number(position.supplyAssets) / Number(position.market.state.supplyAssets)) *
                      100,
                  )}
                  %
                </td>
                <td data-label="% of My Supply" className="text-center">
                  {formatReadable(percentageOfMySupply)}%
                </td>
                <td data-label="Actions" className="text-right">
                  <button
                    type="button"
                    className="bg-hovered rounded-sm p-2 text-xs duration-300 ease-in-out hover:bg-orange-500"
                    onClick={() => {
                      setShowModal(true);
                      setSelectedPosition(position);
                    }}
                  >
                    Withdraw
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
