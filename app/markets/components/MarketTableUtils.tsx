import { Tooltip } from '@nextui-org/tooltip';
import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { SortColumn } from './constants';

type HTSortableProps = {
  label: string | React.ReactNode;
  sortColumn: SortColumn;
  targetColumn: SortColumn;
  titleOnclick: (column: number) => void;
  sortDirection: number;
  toolTip?: string;
  showDirection?: boolean;
};

export function HTSortable({
  label,
  sortColumn,
  titleOnclick,
  sortDirection,
  targetColumn,
  toolTip,
  showDirection = true,
}: HTSortableProps) {
  const sortingCurrent = sortColumn === targetColumn;

  return (
    <th
      className={`${sortingCurrent ? 'text-primary' : ''}`}
      onClick={() => titleOnclick(targetColumn)}
    >
      <div className="flex items-center justify-center gap-1 font-normal hover:cursor-pointer">
        {toolTip ? <Tooltip content={toolTip}>{label}</Tooltip> : <div>{label}</div>}
        {showDirection &&
          (sortingCurrent ? sortDirection === 1 ? <ArrowDownIcon /> : <ArrowUpIcon /> : null)}
      </div>
    </th>
  );
}

export function TDAsset({
  asset,
  chainId,
  img,
  symbol,
  dataLabel,
}: {
  asset: string;
  chainId: number;
  symbol: string;
  dataLabel?: string;
  img?: string;
}) {
  return (
    <td data-label={dataLabel ?? symbol} className="z-50">
      <div className="flex items-center justify-center gap-1">
        {img ? <Image src={img} alt="icon" width="18" height="18" /> : null}
        <a
          className="group flex items-center gap-1 no-underline hover:underline"
          href={getAssetURL(asset, chainId)}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          <p> {symbol} </p>
          <p className="opacity-0 group-hover:opacity-100">
            <ExternalLinkIcon />
          </p>
        </a>
      </div>
    </td>
  );
}

export function TDTotalSupplyOrBorrow({
  dataLabel,
  assetsUSD,
  assets,
  decimals,
  symbol,
}: {
  dataLabel: string;
  assetsUSD: string;
  assets: string;
  decimals: number;
  symbol: string;
}) {
  return (
    <td data-label={dataLabel} className="z-50">
      <p>${formatReadable(Number(assetsUSD)) + '   '} </p>
      <p className="opacity-70">{formatReadable(formatBalance(assets, decimals)) + ' ' + symbol}</p>
    </td>
  );
}
