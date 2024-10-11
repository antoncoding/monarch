import React from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { IoWarningOutline } from 'react-icons/io5';
import { TokenIcon } from '@/components/TokenIcon';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { MarketPosition, GroupedPosition, WarningWithDetail, WarningCategory } from '@/utils/types';
import { getCollateralColor } from '../utils/colors';

type SuppliedMarketsDetailProps = {
  groupedPosition: GroupedPosition;
  setShowModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
};

function WarningTooltip({ warnings }: { warnings: WarningWithDetail[] }) {
  return (
    <div className="p-2 font-zen">
      {Object.values(WarningCategory).map((category) => {
        const categoryWarnings = warnings.filter((w) => w.category === category);
        if (categoryWarnings.length === 0) return null;
        return (
          <div key={category} className="mb-2">
            <h4 className="font-bold capitalize">{category}</h4>
            <ul className="list-none pl-0">
              {categoryWarnings.map((warning, index) => (
                <li key={index}>- {warning.description}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function SuppliedMarketsDetail({
  groupedPosition,
  setShowModal,
  setSelectedPosition,
}: SuppliedMarketsDetailProps) {
  const sortedMarkets = [...groupedPosition.markets].sort(
    (a, b) =>
      Number(formatBalance(b.supplyAssets, b.market.loanAsset.decimals)) -
      Number(formatBalance(a.supplyAssets, a.market.loanAsset.decimals)),
  );

  const totalSupply = groupedPosition.totalSupply;

  const getWarningColor = (warnings: WarningWithDetail[]) => {
    if (warnings.some((w) => w.level === 'alert')) return 'text-red-500';
    if (warnings.some((w) => w.level === 'warning')) return 'text-yellow-500';
    return '';
  };

  return (
    <div className="bg-secondary bg-opacity-20 p-4">
      <div className="mb-4 flex items-center justify-center">
        <div className="my-4 w-1/2">
          <h3 className="mb-2 text-base font-semibold">Collateral Exposure</h3>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
            {groupedPosition.processedCollaterals.map((collateral, colIndex) => (
              <div
                key={`${collateral.address}-${colIndex}`}
                className="h-full opacity-70"
                style={{
                  width: `${collateral.percentage}%`,
                  backgroundColor:
                    collateral.symbol === 'Others'
                      ? '#A0AEC0'
                      : getCollateralColor(collateral.address),
                }}
                title={`${collateral.symbol}: ${collateral.percentage.toFixed(2)}%`}
              />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap justify-center text-xs">
            {groupedPosition.processedCollaterals.map((collateral, colIndex) => (
              <span key={`${collateral.address}-${colIndex}`} className="mb-1 mr-2 opacity-70">
                <span
                  style={{
                    color:
                      collateral.symbol === 'Others'
                        ? '#A0AEC0'
                        : getCollateralColor(collateral.address),
                  }}
                >
                  ■
                </span>{' '}
                {collateral.symbol}: {formatReadable(collateral.percentage)}%
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="no-hover-effect w-full font-zen">
        <thead className="table-header">
          <tr>
            <th>Market</th>
            <th>Collateral</th>
            <th>LLTV</th>
            <th>APY</th>
            <th>Supplied</th>
            <th>% of Portfolio</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody className="table-body text-xs">
          {sortedMarkets.map((position) => {
            const suppliedAmount = Number(
              formatBalance(position.supplyAssets, position.market.loanAsset.decimals),
            );
            const percentageOfPortfolio = totalSupply > 0 ? (suppliedAmount / totalSupply) * 100 : 0;
            const warningColor = getWarningColor(position.warningsWithDetail);

            return (
              <tr key={position.market.uniqueKey} className="gap-1">
                <td data-label="Market" className="text-center">
                  <div className="flex items-center justify-center">
                    <div className="mr-1 w-4">
                      {position.warningsWithDetail.length > 0 ? (
                        <Tooltip
                          content={<WarningTooltip warnings={position.warningsWithDetail} />}
                          placement="top"
                        >
                          <div>
                            <IoWarningOutline className={`h-4 w-4 ${warningColor}`} />
                          </div>
                        </Tooltip>
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                    </div>
                    {/* <Tooltip content="View on Explorer" placement="top"> */}
                    <a
                      className="group flex items-center justify-center no-underline hover:underline"
                      href={getMarketURL(
                        position.market.uniqueKey,
                        position.market.morphoBlue.chain.id,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {position.market.uniqueKey.slice(2, 8)}
                      <ExternalLinkIcon className="ml-1 opacity-0 group-hover:opacity-100" />
                    </a>
                    {/* </Tooltip> */}
                  </div>
                </td>
                <td data-label="Collateral" className="text-center">
                  {position.market.collateralAsset ? (
                    <div className="flex items-center justify-center gap-1">
                      <TokenIcon
                        address={position.market.collateralAsset.address}
                        chainId={position.market.morphoBlue.chain.id}
                        width={18}
                        height={18}
                      />
                      {position.market.collateralAsset.symbol}
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
                <td data-label="% of Portfolio" className="text-center">
                  <div className="flex items-center">
                    <div className="mr-2 h-2 w-full rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${percentageOfPortfolio}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap">
                      {formatReadable(percentageOfPortfolio)}%
                    </span>
                  </div>
                </td>
                <td data-label="Actions" className="text-right">
                  <button
                    type="button"
                    className="bg-hovered rounded-sm p-1 text-xs duration-300 ease-in-out hover:bg-orange-500"
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
