import React from 'react';
import { useMemo, useState } from 'react';
import { Pagination } from '@nextui-org/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import moment from 'moment';
import Image from 'next/image';

import { formatReadable, formatBalance } from '@/utils/balance';
import { getExplorerTxURL, getMarketURL } from '@/utils/external';
import { actionTypeToText } from '@/utils/morpho';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { UserTransaction, UserTxTypes } from '@/utils/types';

type HistoryTableProps = {
  history: UserTransaction[];
};

export function HistoryTable({ history }: HistoryTableProps) {
  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  const pages = Math.ceil(history.length / rowsPerPage);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return history.sort((a, b) => b.timestamp - a.timestamp).slice(start, end);
  }, [page, history]);

  return (
    <Table
      classNames={{
        th: 'bg-secondary',
        wrapper: 'rounded-none shadow-none bg-secondary',
      }}
      bottomContent={
        <div className="flex w-full justify-center">
          <Pagination
            className="text-black"
            isCompact
            showControls
            // showShadow
            variant="light"
            color="default"
            page={page}
            total={pages}
            onChange={(_page: number) => setPage(_page)}
          />
        </div>
      }
    >
      <TableHeader className="table-header">
        <TableColumn className="text-center"> Network </TableColumn>
        <TableColumn className="text-center">Market ID </TableColumn>
        <TableColumn className="text-center">Action</TableColumn>
        <TableColumn className="text-center">Asset</TableColumn>
        <TableColumn className="text-center">
          <div> Timestamp </div>
        </TableColumn>
        <TableColumn className="text-center">
          <div> Tx Hash </div>
        </TableColumn>
      </TableHeader>
      <TableBody>
        {items.map((tx, index) => {
          console.log('tx', tx);

          const loanImg = findToken(
            tx.data.market.loanAsset.address,
            tx.data.market.morphoBlue.chain.id,
          )?.img;

          const networkImg = getNetworkImg(tx.data.market.morphoBlue.chain.id);

          const sign = tx.type === UserTxTypes.MarketSupply ? '+' : '-';

          return (
            <TableRow key={index.toFixed()}>
              <TableCell>
                <div className="flex justify-center">
                  {networkImg && <Image src={networkImg} alt="network" width="20" height="20" />}
                </div>
              </TableCell>

              {/* id */}
              <TableCell>
                <div className="flex justify-center font-monospace text-xs">
                  <a
                    className="group flex items-center gap-1 no-underline hover:underline"
                    href={getMarketURL(
                      tx.data.market.uniqueKey,
                      tx.data.market.morphoBlue.chain.id,
                    )}
                    target="_blank"
                  >
                    <p>{tx.data.market.uniqueKey.slice(2, 8)} </p>
                    <p className="opacity-0 group-hover:opacity-100">
                      <ExternalLinkIcon />
                    </p>
                  </a>
                </div>
              </TableCell>

              {/* Action */}
              <TableCell>
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <div> {actionTypeToText(tx.type)} </div>
                  </div>
                </div>
              </TableCell>

              {/* Asset */}
              <TableCell>
                <div className="flex items-center justify-center gap-1">
                  <div>
                    {' '}
                    {sign}{' '}
                    {formatReadable(
                      formatBalance(tx.data.assets, tx.data.market.loanAsset.decimals),
                    )}{' '}
                  </div>
                  {loanImg ? (
                    <Image src={loanImg} alt="icon" width="18" height="18" />
                  ) : (
                    tx.data.market.loanAsset.symbol
                  )}
                  <p> {} </p>
                </div>
              </TableCell>

              {/* Timestamp */}
              <TableCell className="z-50 text-center">
                {moment(tx.timestamp * 1000).fromNow()}
              </TableCell>

              {/* Tx Hash */}
              <TableCell>
                <div className="flex items-center justify-center gap-1">
                  <a
                    className="group flex items-center gap-1 font-monospace text-xs no-underline hover:underline"
                    href={getExplorerTxURL(tx.hash, tx.data.market.morphoBlue.chain.id)}
                    target="_blank"
                  >
                    <p> {tx.hash.slice(0, 6)} </p>
                    <p className="opacity-0 group-hover:opacity-100">
                      <ExternalLinkIcon />
                    </p>
                  </a>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
