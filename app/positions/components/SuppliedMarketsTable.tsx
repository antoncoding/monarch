import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';

import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { MarketPosition } from '@/utils/types';

type PositionTableProps = {
  marketPositions: MarketPosition[];
  setShowModal: (show: boolean) => void;
  setSelectedPosition: (position: MarketPosition) => void;
};

export function SuppliedMarketsTable({
  marketPositions,
  setShowModal,
  setSelectedPosition,
}: PositionTableProps) {
  return (
    <Table
      classNames={{
        th: 'bg-secondary',
        wrapper: 'rounded-none shadow-none bg-secondary',
      }}
    >
      <TableHeader className="table-header">
        <TableColumn className="text-center"> Network </TableColumn>
        <TableColumn className="text-center"> Market ID </TableColumn>
        <TableColumn className="text-center">
          <div> Supplied Asset </div>
        </TableColumn>
        <TableColumn className="text-center">
          <div> Collateral </div>
        </TableColumn>
        <TableColumn className="text-center">
          <div> LLTV </div>
        </TableColumn>
        <TableColumn className="text-center">
          <div> APY </div>
        </TableColumn>
        <TableColumn className="text-center">
          <div> % of Market </div>
        </TableColumn>

        <TableColumn className="text-center"> Actions </TableColumn>
      </TableHeader>
      <TableBody>
        {marketPositions.map((position, index) => {
          const collatImg = findToken(
            position.market.collateralAsset.address,
            position.market.morphoBlue.chain.id,
          )?.img;
          const loanImg = findToken(
            position.market.loanAsset.address,
            position.market.morphoBlue.chain.id,
          )?.img;

          const networkImg = getNetworkImg(position.market.morphoBlue.chain.id);

          return (
            <TableRow key={index.toFixed()}>
              {/* network */}
              <TableCell>
                <div className="flex justify-center">
                  {networkImg ? <Image src={networkImg} alt="icon" width="18" height="18" /> : null}
                </div>
              </TableCell>

              {/* id */}
              <TableCell>
                <div className="flex justify-center font-monospace text-xs">
                  <a
                    className="group flex items-center gap-1 no-underline hover:underline"
                    href={getMarketURL(
                      position.market.uniqueKey,
                      position.market.morphoBlue.chain.id,
                    )}
                    target="_blank"
                  >
                    <p>{position.market.uniqueKey.slice(2, 8)} </p>
                    <p className="opacity-0 group-hover:opacity-100">
                      <ExternalLinkIcon />
                    </p>
                  </a>
                </div>
              </TableCell>

              {/* supply */}
              <TableCell>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <p>
                      {formatReadable(
                        formatBalance(position.supplyAssets, position.market.loanAsset.decimals),
                      )}{' '}
                    </p>
                    <p> {position.market.loanAsset.symbol} </p>
                    {loanImg ? <Image src={loanImg} alt="icon" width="18" height="18" /> : null}
                  </div>
                </div>
              </TableCell>

              {/* collateral */}
              <TableCell>
                <div className="flex items-center justify-center gap-1">
                  <div> {position.market.collateralAsset.symbol} </div>
                  {collatImg ? <Image src={collatImg} alt="icon" width="18" height="18" /> : null}
                  <p> {} </p>
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center justify-center gap-1">
                  <p> {formatBalance(position.market.lltv, 16)} % </p>
                </div>
              </TableCell>

              {/* APYs */}
              <TableCell className="z-50 text-center">
                {formatReadable(position.market.dailyApys.netSupplyApy * 100)}
                {/* <p>{formatReadable(position.market.weeklyApys.netSupplyApy * 100)}</p> */}
              </TableCell>

              {/* percentage */}
              <TableCell className="justify-center">
                <p className="text-center opacity-70">
                  {formatReadable(
                    (Number(position.supplyAssets) / Number(position.market.state.supplyAssets)) *
                      100,
                  )}
                  %
                </p>
              </TableCell>

              <TableCell className="flex justify-center">
                <button
                  type="button"
                  aria-label="Supply"
                  className="bg-hovered items-center justify-between rounded-sm p-2 text-xs duration-300 ease-in-out hover:scale-110  hover:bg-orange-500 "
                  onClick={() => {
                    setShowModal(true);
                    setSelectedPosition(position);
                  }}
                >
                  Withdraw
                </button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
