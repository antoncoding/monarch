'use client';

import { useMemo, useState } from 'react';
import { Switch } from '@nextui-org/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';
import { Button } from '@/components/common/Button';
import { TokenIcon } from '@/components/TokenIcon';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { Market, MarketProgramType } from '@/utils/types';

type MarketProgramProps = {
  account: string;
  markets: Market[];
  marketRewards: MarketProgramType[];
  distributions: DistributionResponseType[];
};

export default function MarketProgram({
  marketRewards,
  markets,
  distributions,
  account,
}: MarketProgramProps) {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(false);

  const { sendTransaction } = useTransactionWithToast({
    toastId: 'claim',
    pendingText: 'Claiming Market Reward...',
    successText: 'Market Reward Claimed!',
    errorText: 'Failed to claim market rewards',
    chainId,
    pendingDescription: `Claiming market rewards`,
    successDescription: `Successfully claimed market rewards`,
  });

  const allRewardTokens = useMemo(
    () => {
      // First, group rewards by asset address and chain ID
      const groupedRewards = marketRewards.reduce((acc, reward) => {
        const key = `${reward.asset.address.toLowerCase()}-${reward.asset.chain_id}`;
        if (!acc[key]) {
          acc[key] = {
            rewards: [],
            token: reward.asset.address,
            chainId: reward.asset.chain_id,
            distribution: distributions.find(
              (d) => d.asset.address.toLowerCase() === reward.asset.address.toLowerCase(),
            ),
          };
        }
        acc[key].rewards.push(reward);
        return acc;
      }, {} as Record<string, { rewards: MarketProgramType[]; token: string; chainId: number; distribution?: DistributionResponseType }>);

      // Then, calculate totals for each group
      return Object.values(groupedRewards).map((group) => {
        const claimable = group.rewards.reduce(
          (sum, reward) =>
            sum +
            BigInt(reward.for_supply?.claimable_now ?? '0') +
            BigInt(reward.for_borrow?.claimable_now ?? '0') +
            BigInt(reward.for_collateral?.claimable_now ?? '0'),
          BigInt(0),
        );

        const pending = group.rewards.reduce(
          (sum, reward) =>
            sum +
            BigInt(reward.for_supply?.claimable_next ?? '0') +
            BigInt(reward.for_borrow?.claimable_next ?? '0') +
            BigInt(reward.for_collateral?.claimable_next ?? '0'),
          BigInt(0),
        );

        const total = group.rewards.reduce(
          (sum, reward) =>
            sum +
            BigInt(reward.for_supply?.total ?? '0') +
            BigInt(reward.for_borrow?.total ?? '0') +
            BigInt(reward.for_collateral?.total ?? '0'),
          BigInt(0),
        );

        const claimed = group.rewards.reduce(
          (sum, reward) =>
            sum +
            BigInt(reward.for_supply?.claimed ?? '0') +
            BigInt(reward.for_borrow?.claimed ?? '0') +
            BigInt(reward.for_collateral?.claimed ?? '0'),
          BigInt(0),
        );

        return {
          token: group.token,
          chainId: group.chainId,
          distribution: group.distribution,
          claimable,
          pending,
          total,
          claimed,
          rewards: group.rewards, // Keep original rewards for detail view
        };
      });
    },
    [marketRewards, distributions],
  );

  const filteredRewardTokens = useMemo(
    () => allRewardTokens.filter((tokenReward) => showPending || tokenReward.claimable > BigInt(0)),
    [allRewardTokens, showPending],
  );

  const handleRowClick = (token: string) => {
    setSelectedToken((prevToken) => (prevToken === token ? null : token));
  };

  return (
    <div className="mt-4 gap-8">
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-sm text-secondary">Show Pending</span>
        <Switch
          size="sm"
          isSelected={showPending}
          onValueChange={setShowPending}
          aria-label="Show pending rewards"
        />
      </div>
      <div className="bg-surface mb-6 mt-2">
        <Table
          aria-label="Market Program Rewards Table"
          classNames={{
            th: 'bg-surface text-center',
            td: 'text-center',
            wrapper: 'rounded-none shadow-none bg-surface',
          }}
        >
          <TableHeader>
            <TableColumn align="center">Asset</TableColumn>
            <TableColumn align="center">Chain</TableColumn>
            <TableColumn align="center">Claimable</TableColumn>
            <TableColumn align="center">Pending</TableColumn>
            <TableColumn align="center">Claimed</TableColumn>
            <TableColumn align="center">Total</TableColumn>
            <TableColumn align="end">Action</TableColumn>
          </TableHeader>
          <TableBody>
            {filteredRewardTokens
              .filter((tokenReward) => tokenReward !== null && tokenReward !== undefined)
              .map((tokenReward, index) => {
                const matchedToken = findToken(tokenReward.token, tokenReward.chainId) ?? {
                  symbol: 'Unknown',
                  img: undefined,
                  decimals: 18,
                };

                return (
                  <TableRow
                    key={index}
                    className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      selectedToken === tokenReward.token ? 'bg-gray-200 dark:bg-gray-700' : ''
                    }`}
                    onClick={() => handleRowClick(tokenReward.token)}
                  >
                    <TableCell>
                      <Link
                        href={getAssetURL(tokenReward.token, tokenReward.chainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 hover:opacity-80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>{matchedToken.symbol}</p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={20}
                          height={20}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Image
                          src={getNetworkImg(tokenReward.chainId) ?? ''}
                          alt={`Chain ${tokenReward.chainId}`}
                          width={20}
                          height={20}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatReadable(formatBalance(tokenReward.claimable, matchedToken.decimals))}
                        </p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatReadable(formatBalance(tokenReward.pending, matchedToken.decimals))}
                        </p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatReadable(formatBalance(tokenReward.claimed, matchedToken.decimals))}
                        </p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>{formatReadable(formatBalance(tokenReward.total, matchedToken.decimals))}</p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell align="center">
                      <div className="flex justify-center">
                        <Button
                          variant="interactive"
                          size="sm"
                          isDisabled={
                            tokenReward.claimable === BigInt(0) || tokenReward.distribution === undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!account) {
                              toast.error('Connect wallet');
                              return;
                            }
                            if (!tokenReward.distribution) {
                              toast.error('No claim data');
                              return;
                            }
                            if (chainId !== tokenReward.distribution.distributor.chain_id) {
                              switchChain({ chainId: tokenReward.chainId });
                              toast('Click on claim again after switching network');
                              return;
                            }
                            sendTransaction({
                              account: account as Address,
                              to: tokenReward.distribution.distributor.address as Address,
                              data: tokenReward.distribution.tx_data as `0x${string}`,
                              chainId: tokenReward.distribution.distributor.chain_id,
                            });
                          }}
                        >
                          Claim
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {selectedToken && (
        <div className="bg-surface mt-8 p-4">
          <h3 className="mb-4 text-lg font-semibold">
            {' '}
            Reward Breakdown for{' '}
            {
              findToken(
                selectedToken,
                allRewardTokens.find((t) => t.token === selectedToken)?.chainId ?? 1,
              )?.symbol
            }
          </h3>
          <Table aria-label="Reward Breakdown">
            <TableHeader>
              <TableColumn>Market ID</TableColumn>
              <TableColumn>Loan Asset</TableColumn>
              <TableColumn>Collateral</TableColumn>
              <TableColumn>LLTV</TableColumn>
              <TableColumn>Supply Claimable</TableColumn>
              <TableColumn>Supply Pending</TableColumn>
              <TableColumn>Supply Claimed</TableColumn>
              <TableColumn>Supply Total</TableColumn>
              <TableColumn>Borrow Claimable</TableColumn>
              <TableColumn>Borrow Pending</TableColumn>
              <TableColumn>Borrow Claimed</TableColumn>
              <TableColumn>Borrow Total</TableColumn>
              <TableColumn>Collateral Claimable</TableColumn>
              <TableColumn>Collateral Pending</TableColumn>
              <TableColumn>Collateral Claimed</TableColumn>
              <TableColumn>Collateral Total</TableColumn>
            </TableHeader>
            <TableBody>
              {markets
                .filter((m) =>
                  marketRewards.find(
                    (r) =>
                      r.program &&
                      r.program.market_id.toLowerCase() === m.uniqueKey.toLowerCase() &&
                      r.program.asset.address.toLowerCase() === selectedToken.toLowerCase(),
                  ),
                )
                .map((market, idx) => {
                  const tokenRewardsForMarket = marketRewards.filter((reward) => {
                    if (!reward.program) return false;
                    return (
                      reward.program.market_id === market.uniqueKey &&
                      reward.program.asset.address.toLowerCase() === selectedToken.toLowerCase()
                    );
                  });

                  const supplyClaimable = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimable_now ?? '0');
                  }, BigInt(0));
                  const supplyPending = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimable_next ?? '0');
                  }, BigInt(0));
                  const supplyTotal = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.total ?? '0');
                  }, BigInt(0));
                  const supplyClaimed = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimed ?? '0');
                  }, BigInt(0));

                  const borrowClaimable = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_borrow?.claimable_now ?? '0');
                  }, BigInt(0));
                  const borrowPending = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_borrow?.claimable_next ?? '0');
                  }, BigInt(0));
                  const borrowTotal = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_borrow?.total ?? '0');
                  }, BigInt(0));
                  const borrowClaimed = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_borrow?.claimed ?? '0');
                  }, BigInt(0));

                  const collateralClaimable = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_collateral?.claimable_now ?? '0');
                  }, BigInt(0));
                  const collateralPending = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_collateral?.claimable_next ?? '0');
                  }, BigInt(0));
                  const collateralTotal = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_collateral?.total ?? '0');
                  }, BigInt(0));
                  const collateralClaimed = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_collateral?.claimed ?? '0');
                  }, BigInt(0));

                  const matchedToken = findToken(selectedToken, market.morphoBlue.chain.id);

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-monospace no-underline">
                        <Link href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}>
                          {market.uniqueKey.slice(2, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{market.loanAsset.symbol}</TableCell>
                      <TableCell>{market.collateralAsset.symbol}</TableCell>
                      <TableCell>{formatBalance(market.lltv, 16)}%</TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(supplyClaimable, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(supplyPending, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(supplyClaimed, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(supplyTotal, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(borrowClaimable, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(borrowPending, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(borrowClaimed, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(borrowTotal, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(
                          formatBalance(collateralClaimable, matchedToken?.decimals ?? 18),
                        )}
                      </TableCell>
                      <TableCell>
                        {formatReadable(
                          formatBalance(collateralPending, matchedToken?.decimals ?? 18),
                        )}
                      </TableCell>
                      <TableCell>
                        {formatReadable(
                          formatBalance(collateralClaimed, matchedToken?.decimals ?? 18),
                        )}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(collateralTotal, matchedToken?.decimals ?? 18))}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
