import { useMemo, useState } from 'react';
import { Link, Pagination } from '@nextui-org/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import moment from 'moment';
import Image from 'next/image';
import { Address, formatUnits } from 'viem';
import AccountWithAvatar from '@/components/Account/AccountWithAvatar';
import { MarketLiquidationTransaction } from '@/hooks/useMarketLiquidations';
import { getExplorerTxURL, getExplorerURL } from '@/utils/external';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';

// Helper functions to format data
const formatAddress = (address: string) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

type LiquidationsTableProps = {
  chainId: number;
  liquidations: MarketLiquidationTransaction[];
  loading: boolean;
  error: string | null;
  market: Market;
};

export function LiquidationsTable({
  chainId,
  liquidations,
  loading,
  error,
  market,
}: LiquidationsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.ceil(liquidations.length / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const paginatedLiquidations = useMemo(() => {
    const sliced = liquidations.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return sliced;
  }, [currentPage, liquidations, pageSize]);

  const tableKey = `liquidations-table-${currentPage}`;

  const collateralToken = useMemo(() => {
    if (!market) return null;
    return findToken(market.collateralAsset.address, chainId);
  }, [market, chainId]);

  const loanToken = useMemo(() => {
    if (!market) return null;
    return findToken(market.loanAsset.address, chainId);
  }, [market, chainId]);

  if (error) {
    return <p className="text-danger">Error loading liquidations: {error}</p>;
  }

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-xl font-semibold">Liquidations</h4>

      <Table
        key={tableKey}
        aria-label="Liquidations history"
        bottomContent={
          totalPages > 1 ? (
            <div className="flex w-full justify-center">
              <Pagination
                isCompact
                showControls
                color="primary"
                page={currentPage}
                total={totalPages}
                onChange={handlePageChange}
              />
            </div>
          ) : null
        }
      >
        <TableHeader>
          <TableColumn>Liquidator</TableColumn>
          <TableColumn align="end">Repaid ({market?.loanAsset?.symbol ?? 'USDC'})</TableColumn>
          <TableColumn align="end">
            Seized{' '}
            {market?.collateralAsset?.symbol && (
              <span className="inline-flex items-center">{market.collateralAsset.symbol}</span>
            )}
          </TableColumn>
          <TableColumn>Time</TableColumn>
          <TableColumn className="font-mono">Transaction</TableColumn>
        </TableHeader>
        <TableBody
          className="font-zen"
          emptyContent={loading ? 'Loading...' : 'No liquidations found for this market'}
          isLoading={loading}
        >
          {paginatedLiquidations.map((liquidation) => (
            <TableRow key={liquidation.hash}>
              <TableCell>
                <Link
                  href={getExplorerURL(liquidation.data.liquidator, chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-primary"
                >
                  <AccountWithAvatar address={liquidation.data.liquidator as Address} />
                  <ExternalLinkIcon className="ml-1" />
                </Link>
              </TableCell>
              <TableCell className="text-right">
                {formatUnits(BigInt(liquidation.data.repaidAssets), loanToken?.decimals ?? 6)}
                {market?.loanAsset?.symbol && (
                  <span className="ml-1 inline-flex items-center">
                    {loanToken?.img && (
                      <Image
                        src={loanToken.img}
                        alt={market.loanAsset.symbol || ''}
                        width={16}
                        height={16}
                        className="rounded-full"
                      />
                    )}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {formatUnits(
                  BigInt(liquidation.data.seizedAssets),
                  collateralToken?.decimals ?? 18,
                )}
                {market?.collateralAsset?.symbol && (
                  <span className="ml-1 inline-flex items-center">
                    {collateralToken?.img && (
                      <Image
                        src={collateralToken.img}
                        alt={market.collateralAsset.symbol}
                        width={16}
                        height={16}
                        className="rounded-full"
                      />
                    )}
                  </span>
                )}
              </TableCell>
              <TableCell>{moment.unix(liquidation.timestamp).fromNow()}</TableCell>
              <TableCell className="font-zen ">
                <Link
                  href={getExplorerTxURL(liquidation.hash, chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-secondary"
                >
                  {formatAddress(liquidation.hash)}
                  <ExternalLinkIcon className="ml-1" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
