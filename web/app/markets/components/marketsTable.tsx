import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { Market } from '@/hooks/useMarkets';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL, getAssetURL } from '@/utils/external';
import { supportedTokens } from '@/utils/tokens';

const MORPHO_LOGO = require('../../../src/imgs/tokens/morpho.svg') as string;

type MarketsTableProps = {
  sortColumn: number;
  titleOnclick: (column: number) => void;
  sortDirection: number;
  markets: Market[];
  setShowSupplyModal: (show: boolean) => void;
  setSelectedMarket: (market: Market) => void;
};

function MarketsTable({
  sortColumn,
  titleOnclick,
  sortDirection,
  markets,
  setShowSupplyModal,
  setSelectedMarket,
}: MarketsTableProps) {
  return (
    <table className="font-roboto w-full">
      <thead className="table-header">
        <tr>
          <th> Id </th>
          <th
            className={`${sortColumn === 1 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(1)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Loan</div>
              {sortColumn === 1 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 1 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 2 ? 'text-primary' : ''} `}
            onClick={() => titleOnclick(2)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div> Collateral </div>
              {sortColumn === 2 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 2 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 3 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(3)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>LLTV </div>
              {sortColumn === 3 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 3 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 4 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(4)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Rewards </div>
              {sortColumn === 4 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 4 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 5 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(5)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Total Supply </div>
              {sortColumn === 5 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 5 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 6 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(6)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div> Total Borrow </div>
              {sortColumn === 6 && sortDirection === 1 ? (
                <ArrowDownIcon className="mt-1" />
              ) : sortColumn === 6 && sortDirection === -1 ? (
                <ArrowUpIcon className="mt-1" />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 7 ? 'text-primary' : ''} `}
            onClick={() => titleOnclick(7)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Supply APY(%)</div>
              {sortColumn === 7 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 7 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th> Actions </th>
        </tr>
      </thead>
      <tbody className="table-body text-sm">
        {markets.map((item, index) => {
          const collatImg = supportedTokens.find(
            (token) => token.address.toLowerCase() === item.collateralAsset.address.toLowerCase(),
          )?.img;
          const loanImg = supportedTokens.find(
            (token) => token.address.toLowerCase() === item.loanAsset.address.toLowerCase(),
          )?.img;

          const collatToShow = item.collateralAsset.symbol
            .slice(0, 6)
            .concat(item.collateralAsset.symbol.length > 6 ? '...' : '');

          return (
            <tr key={index.toFixed()}>
              {/* id */}
              <td>
                <div className="flex justify-center">
                  <a
                    className="group flex items-center gap-1 no-underline hover:underline"
                    href={getMarketURL(item.uniqueKey)}
                    target="_blank"
                  >
                    <p>{item.uniqueKey.slice(2, 8)} </p>
                    <p className="opacity-0 group-hover:opacity-100">
                      <ExternalLinkIcon />
                    </p>
                  </a>
                </div>
              </td>

              {/* loan */}
              <td>
                <div className="flex items-center justify-center gap-1">
                  {loanImg ? <Image src={loanImg} alt="icon" width="18" height="18" /> : null}
                  <a
                    className="group flex items-center gap-1 no-underline hover:underline"
                    href={getAssetURL(item.loanAsset.address)}
                    target="_blank"
                  >
                    <p> {item.loanAsset.symbol} </p>
                    <p className="opacity-0 group-hover:opacity-100">
                      <ExternalLinkIcon />
                    </p>
                  </a>
                </div>
              </td>

              {/* collateral */}
              <td>
                <div className="flex items-center justify-center gap-1">
                  {collatImg ? <Image src={collatImg} alt="icon" width="18" height="18" /> : null}
                  <a
                    className="group flex items-center gap-1 no-underline hover:underline"
                    href={getAssetURL(item.collateralAsset.address)}
                    target="_blank"
                  >
                    <p> {collatToShow} </p>
                    <p className="opacity-0 group-hover:opacity-100">
                      <ExternalLinkIcon />
                    </p>
                  </a>
                </div>
              </td>

              {/* lltv */}
              <td>{Number(item.lltv) / 1e16}%</td>

              {/* rewards */}
              <td>
                <div className="flex items-center justify-center gap-1">
                  {' '}
                  <p>
                    {' '}
                    {item.rewardPer1000USD ? formatReadable(Number(item.rewardPer1000USD)) : '-'}
                  </p>
                  {item.rewardPer1000USD && (
                    <Image src={MORPHO_LOGO} alt="icon" width="18" height="18" />
                  )}
                </div>
              </td>

              {/* total supply */}
              <td className="z-50">
                <p>${formatReadable(Number(item.state.supplyAssetsUsd)) + '   '} </p>
                <p className="opacity-70">
                  {formatBalance(item.state.supplyAssets, item.loanAsset.decimals).toLocaleString(
                    'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  ) +
                    ' ' +
                    item.loanAsset.symbol}
                </p>
              </td>

              {/* total borrow */}
              <td>
                <p>${formatReadable(Number(item.state.borrowAssetsUsd))} </p>
                <p style={{ opacity: '0.7' }}>
                  {formatBalance(item.state.borrowAssets, item.loanAsset.decimals).toLocaleString(
                    'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  ) +
                    ' ' +
                    item.loanAsset.symbol}
                </p>
              </td>

              {/* <td> {item.loanAsset.address} </td> */}

              <td>{(item.state.supplyApy * 100).toFixed(3)}</td>

              <td>
                <button
                  type="button"
                  aria-label="Supply"
                  className="bg-hovered items-center justify-between rounded-sm p-2 text-xs duration-300 ease-in-out hover:scale-110  hover:bg-orange-500 "
                  onClick={() => {
                    setShowSupplyModal(true);
                    setSelectedMarket(item);
                  }}
                >
                  Supply
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default MarketsTable;
