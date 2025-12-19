import Link from 'next/link';
import { formatUnits } from 'viem';
import { TableBody, TableRow, TableCell } from '@/components/ui/table';
import { AccountIdentity } from '@/components/shared/account-identity';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatReadable } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';
import { getTruncatedAssetName } from '@/utils/oracle';
import { findToken } from '@/utils/tokens';
import type { Market } from '@/utils/types';

type TransactionOperation = {
  txId: string;
  txHash: string;
  timestamp: string;
  user: string;
  loanAddress: string;
  loanSymbol: string;
  side: 'Supply' | 'Withdraw';
  amount: string;
  marketId: string;
  market?: Market;
};

type TransactionTableBodyProps = {
  operations: TransactionOperation[];
  selectedNetwork: SupportedNetworks;
};

const formatTimeAgo = (timestamp: string): string => {
  const now = Date.now();
  const txTime = Number(timestamp) * 1000;
  const diffInSeconds = Math.floor((now - txTime) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears}y ago`;
};

const formatAmount = (amount: string, side: 'Supply' | 'Withdraw', loanAddress: string, chainId: number): string => {
  if (!amount || amount === '0') return '—';

  const token = findToken(loanAddress, chainId);
  const decimals = token?.decimals ?? 18;
  const symbol = token?.symbol ?? '';

  const formatted = formatUnits(BigInt(amount), decimals);
  const sign = side === 'Supply' ? '+' : '-';
  return `${sign}${formatReadable(Number(formatted))} ${symbol}`;
};

export function TransactionTableBody({ operations, selectedNetwork }: TransactionTableBodyProps) {
  return (
    <TableBody className="text-sm">
      {operations.map((op) => {
        const marketPath = op.market ? `/market/${selectedNetwork}/${op.market.uniqueKey}` : null;

        return (
          <TableRow
            key={op.txId}
            className="hover:bg-hovered"
          >
            {/* User Address */}
            <TableCell
              data-label="User"
              className="z-50"
              style={{ minWidth: '120px' }}
            >
              <AccountIdentity
                address={op.user as `0x${string}`}
                variant="badge"
                linkTo="profile"
              />
            </TableCell>

            {/* Loan Asset */}
            <TableCell
              data-label="Loan Asset"
              className="z-50"
              style={{ minWidth: '100px' }}
            >
              <div className="flex items-center gap-1.5">
                <TokenIcon
                  address={op.loanAddress}
                  chainId={selectedNetwork}
                  symbol={op.loanSymbol}
                  width={16}
                  height={16}
                />
                <span className="text-sm whitespace-nowrap">{getTruncatedAssetName(op.loanSymbol)}</span>
              </div>
            </TableCell>

            {/* Market */}
            <TableCell
              data-label="Market"
              className="z-50"
              style={{ minWidth: '200px' }}
            >
              {op.market && marketPath ? (
                <Link
                  href={marketPath}
                  className="no-underline hover:no-underline"
                >
                  <div className="flex items-center gap-2">
                    <MarketIdBadge
                      marketId={op.market.uniqueKey}
                      chainId={op.market.morphoBlue.chain.id}
                      showLink={false}
                    />
                    <MarketIdentity
                      market={op.market}
                      focus={MarketIdentityFocus.Collateral}
                      chainId={op.market.morphoBlue.chain.id}
                      mode={MarketIdentityMode.Minimum}
                    />
                  </div>
                </Link>
              ) : (
                <span className="text-xs text-secondary">—</span>
              )}
            </TableCell>

            {/* Side */}
            <TableCell
              data-label="Side"
              className="z-50 text-center"
              style={{ minWidth: '80px' }}
            >
              <span
                className={`inline-flex items-center rounded bg-hovered px-2 py-1 text-xs ${
                  op.side === 'Supply' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {op.side}
              </span>
            </TableCell>

            {/* Amount */}
            <TableCell
              data-label="Amount"
              className="z-50"
              style={{ minWidth: '120px' }}
            >
              <span className="text-sm">{formatAmount(op.amount, op.side, op.loanAddress, selectedNetwork)}</span>
            </TableCell>

            {/* Transaction Hash */}
            <TableCell
              data-label="Tx Hash"
              className="z-50"
              style={{ minWidth: '120px' }}
            >
              <TransactionIdentity
                txHash={op.txHash}
                chainId={selectedNetwork}
              />
            </TableCell>

            {/* Time */}
            <TableCell
              data-label="Time"
              className="z-50"
              style={{ minWidth: '90px' }}
            >
              <span className="text-xs text-secondary whitespace-nowrap">{formatTimeAgo(op.timestamp)}</span>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
}
