import React from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { TokenIcon } from '@/components/TokenIcon';
import { formatReadable } from '@/utils/balance';
import { getExplorerTxURL, getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import { Transaction } from '@/utils/statsUtils';
import { findToken } from '@/utils/tokens';
import { getTruncatedAssetName } from '@/utils/oracle';

type TransactionTableBodyProps = {
  currentEntries: Transaction[];
  selectedNetwork: SupportedNetworks;
};

type MarketInfo = {
  loanAddress: string;
  collateralAddress?: string;
};

type LoanAssetInfo = {
  address: string;
  symbol: string;
};

const formatAddress = (address: string): string => {
  if (address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const extractLoanAssets = (tx: Transaction, chainId: number): LoanAssetInfo[] => {
  const loanAssetsSet = new Map<string, LoanAssetInfo>();

  // Extract from supplies
  tx.supplies?.forEach((supply) => {
    if (supply.market?.loan) {
      const address = supply.market.loan.toLowerCase();
      if (!loanAssetsSet.has(address)) {
        const token = findToken(address, chainId);
        loanAssetsSet.set(address, {
          address,
          symbol: token?.symbol ?? 'Unknown',
        });
      }
    }
  });

  // Extract from withdrawals
  tx.withdrawals?.forEach((withdrawal) => {
    if (withdrawal.market?.loan) {
      const address = withdrawal.market.loan.toLowerCase();
      if (!loanAssetsSet.has(address)) {
        const token = findToken(address, chainId);
        loanAssetsSet.set(address, {
          address,
          symbol: token?.symbol ?? 'Unknown',
        });
      }
    }
  });

  return Array.from(loanAssetsSet.values());
};

const extractMarkets = (tx: Transaction): MarketInfo[] => {
  const marketsSet = new Map<string, MarketInfo>();

  // Extract from supplies
  tx.supplies?.forEach((supply) => {
    if (supply.market?.loan) {
      const key = `${supply.market.loan}-${supply.market.collateral ?? 'none'}`;
      if (!marketsSet.has(key)) {
        marketsSet.set(key, {
          loanAddress: supply.market.loan,
          collateralAddress: supply.market.collateral,
        });
      }
    }
  });

  // Extract from withdrawals
  tx.withdrawals?.forEach((withdrawal) => {
    if (withdrawal.market?.loan) {
      const key = `${withdrawal.market.loan}-${withdrawal.market.collateral ?? 'none'}`;
      if (!marketsSet.has(key)) {
        marketsSet.set(key, {
          loanAddress: withdrawal.market.loan,
          collateralAddress: withdrawal.market.collateral,
        });
      }
    }
  });

  return Array.from(marketsSet.values());
};

const formatVolume = (volume: string, assetAddress: string, chainId: number): string => {
  if (!volume || volume === '0') return '—';

  const token = findToken(assetAddress, chainId);
  const decimals = token?.decimals ?? 18;
  const symbol = token?.symbol ?? '';

  const formatted = formatUnits(BigInt(volume), decimals);
  return `${formatReadable(Number(formatted))} ${symbol}`;
};

export function TransactionTableBody({
  currentEntries,
  selectedNetwork,
}: TransactionTableBodyProps) {
  return (
    <tbody className="table-body text-sm">
      {currentEntries.map((tx) => {
        const loanAssets = extractLoanAssets(tx, selectedNetwork);
        const markets = extractMarkets(tx);
        const totalVolume =
          Number(BigInt(tx.supplyVolume ?? '0') + BigInt(tx.withdrawVolume ?? '0'));

        // Get primary asset for volume formatting (from first supply or withdrawal)
        const primaryAsset =
          tx.supplies?.[0]?.market?.loan ?? tx.withdrawals?.[0]?.market?.loan ?? '';

        return (
          <tr key={tx.id} className="hover:bg-hovered">
            {/* Transaction Hash */}
            <td data-label="Tx Hash" className="z-50" style={{ minWidth: '100px' }}>
              <Link
                href={getExplorerTxURL(tx.id, selectedNetwork)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {formatAddress(tx.id)}
                <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            </td>

            {/* User Address */}
            <td data-label="User" className="z-50" style={{ minWidth: '100px' }}>
              <Link
                href={getExplorerURL(tx.user, selectedNetwork)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {formatAddress(tx.user)}
                <ExternalLinkIcon className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </Link>
            </td>

            {/* Loan Assets */}
            <td data-label="Loan Asset" className="z-50" style={{ minWidth: '120px' }}>
              <div className="flex flex-wrap gap-2">
                {loanAssets.length > 0 ? (
                  loanAssets.slice(0, 2).map((asset, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <TokenIcon
                        address={asset.address}
                        chainId={selectedNetwork}
                        symbol={asset.symbol}
                        width={16}
                        height={16}
                      />
                      <span className="text-sm whitespace-nowrap">
                        {getTruncatedAssetName(asset.symbol)}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-secondary">—</span>
                )}
                {loanAssets.length > 2 && (
                  <span className="text-xs text-secondary">+{loanAssets.length - 2}</span>
                )}
              </div>
            </td>

            {/* Markets (Collateral only) */}
            <td data-label="Markets" className="z-50" style={{ minWidth: '120px' }}>
              <div className="flex flex-wrap gap-1.5">
                {markets.length > 0 ? (
                  markets.slice(0, 3).map((market, idx) => {
                    const collateralToken = market.collateralAddress
                      ? findToken(market.collateralAddress, selectedNetwork)
                      : null;
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        {market.collateralAddress ? (
                          <>
                            <TokenIcon
                              address={market.collateralAddress}
                              chainId={selectedNetwork}
                              symbol={collateralToken?.symbol}
                              width={16}
                              height={16}
                            />
                            <span className="text-xs">
                              {getTruncatedAssetName(collateralToken?.symbol ?? 'Unknown')}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-secondary">Idle</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-secondary">—</span>
                )}
                {markets.length > 3 && (
                  <span className="text-xs text-secondary">+{markets.length - 3}</span>
                )}
              </div>
            </td>

            {/* Timestamp */}
            <td data-label="Time" className="z-50" style={{ minWidth: '110px' }}>
              <span className="text-sm whitespace-nowrap">{formatTimestamp(tx.timestamp)}</span>
            </td>

            {/* Supply Volume */}
            <td data-label="Supply Vol" className="z-50" style={{ minWidth: '120px' }}>
              <span className="text-sm">
                {formatVolume(tx.supplyVolume ?? '0', primaryAsset, selectedNetwork)}
              </span>
            </td>

            {/* Supply Count */}
            <td data-label="Supply #" className="z-50 text-center" style={{ minWidth: '80px' }}>
              <span className="text-sm">{tx.supplyCount ?? 0}</span>
            </td>

            {/* Withdraw Volume */}
            <td data-label="Withdraw Vol" className="z-50" style={{ minWidth: '120px' }}>
              <span className="text-sm">
                {formatVolume(tx.withdrawVolume ?? '0', primaryAsset, selectedNetwork)}
              </span>
            </td>

            {/* Withdraw Count */}
            <td data-label="Withdraw #" className="z-50 text-center" style={{ minWidth: '80px' }}>
              <span className="text-sm">{tx.withdrawCount ?? 0}</span>
            </td>

            {/* Total Volume */}
            <td data-label="Total Vol" className="z-50" style={{ minWidth: '120px' }}>
              <span className="text-sm font-medium">
                {totalVolume > 0
                  ? formatVolume(
                      (BigInt(tx.supplyVolume ?? '0') + BigInt(tx.withdrawVolume ?? '0')).toString(),
                      primaryAsset,
                      selectedNetwork,
                    )
                  : '—'}
              </span>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}
