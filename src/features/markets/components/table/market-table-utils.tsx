import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { TableHead, TableCell } from '@/components/ui/table';
import { TokenIcon } from '@/components/shared/token-icon';
import { EstimatedValueTooltip } from '@/components/shared/estimated-value-tooltip';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import type { SortColumn } from '../constants';

type HTSortableProps = {
  label: string | React.ReactNode;
  sortColumn: SortColumn;
  targetColumn: SortColumn;
  titleOnclick: (column: number) => void;
  sortDirection: number;
  showDirection?: boolean;
};

export function HTSortable({ label, sortColumn, titleOnclick, sortDirection, targetColumn, showDirection = true }: HTSortableProps) {
  const sortingCurrent = sortColumn === targetColumn;

  return (
    <TableHead
      className={`px-2 py-1 ${sortingCurrent ? 'text-primary' : ''}`}
      onClick={() => titleOnclick(targetColumn)}
      style={{ padding: '0.5rem' }}
    >
      <div className="flex items-center justify-center gap-1 font-normal hover:cursor-pointer whitespace-nowrap">
        <div>{label}</div>
        {showDirection && (sortingCurrent ? sortDirection === 1 ? <ArrowDownIcon /> : <ArrowUpIcon /> : null)}
      </div>
    </TableHead>
  );
}

export function TDAsset({ asset, chainId, symbol, dataLabel }: { asset: string; chainId: number; symbol: string; dataLabel?: string }) {
  return (
    <TableCell
      data-label={dataLabel ?? symbol}
      className="z-50"
      style={{ minWidth: '9px' }}
    >
      <div className="flex items-center justify-center gap-1 whitespace-nowrap">
        <TokenIcon
          address={asset}
          chainId={chainId}
          width={16}
          height={16}
          symbol={symbol}
        />
        <a
          className="group flex items-center gap-0.5 no-underline hover:underline"
          href={getAssetURL(asset, chainId)}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm whitespace-nowrap">{symbol.length > 5 ? `${symbol.slice(0, 5)}...` : symbol}</p>
          <p className="opacity-0 group-hover:opacity-100">
            <ExternalLinkIcon className="h-3 w-3" />
          </p>
        </a>
      </div>
    </TableCell>
  );
}

export function TDTotalSupplyOrBorrow({
  dataLabel,
  assetsUSD,
  assets,
  decimals,
  symbol,
  isEstimated = false,
}: {
  dataLabel: string;
  assetsUSD: number;
  assets: string;
  decimals: number;
  symbol: string;
  isEstimated?: boolean;
}) {
  return (
    <TableCell
      data-label={dataLabel}
      className="z-50"
      style={{ minWidth: '120px' }}
    >
      <p className="z-50">
        <EstimatedValueTooltip isEstimated={isEstimated}>${formatReadable(Number(assetsUSD))}</EstimatedValueTooltip>
      </p>
      <p className="z-50 opacity-70">{`${formatReadable(formatBalance(assets, decimals))} ${symbol}`}</p>
    </TableCell>
  );
}
