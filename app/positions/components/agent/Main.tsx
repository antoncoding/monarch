import { Tooltip } from '@nextui-org/react';
import { motion } from 'framer-motion';
import moment from 'moment';
import Image from 'next/image';
import Link from 'next/link';
import { GrStatusGood } from 'react-icons/gr';
import { Button } from '@/components/common';
import { TooltipContent } from '@/components/TooltipContent';
import { useMarkets } from '@/contexts/MarketsContext';
import { findAgent } from '@/utils/monarch-agent';
import { findToken } from '@/utils/tokens';
import { UserRebalancerInfo, UserTransaction } from '@/utils/types';

const img = require('../../../../src/imgs/agent/agent-detailed.png') as string;

type MainProps = {
  account?: string;
  onNext: () => void;
  userRebalancerInfo: UserRebalancerInfo;
  history: UserTransaction[];
};

export function Main({ account, onNext, userRebalancerInfo, history }: MainProps) {
  const agent = findAgent(userRebalancerInfo.rebalancer);
  const { markets } = useMarkets();

  if (!agent) {
    return null;
  }

  // Find markets that the agent is authorized to manage
  const authorizedMarkets = markets.filter((market) =>
    userRebalancerInfo.marketCaps.some(
      (cap) => cap.marketId.toLowerCase() === market.uniqueKey.toLowerCase(),
    ),
  );

  // Group markets by loan asset address
  const loanAssetGroups = authorizedMarkets.reduce(
    (acc, market) => {
      const address = market.loanAsset.address.toLowerCase();
      if (!acc[address]) {
        acc[address] = {
          address,
          chainId: market.morphoBlue.chain.id,
          markets: [],
        };
      }
      acc[address].markets.push(market);
      return acc;
    },
    {} as Record<string, { address: string; chainId: number; markets: typeof authorizedMarkets }>,
  );

  // sort from newest to oldest
  const lastTx = history
    .sort((a, b) => b.timestamp - a.timestamp)
    .find((tx) =>
      userRebalancerInfo.transactions.find(
        (t) => t.transactionHash.toLowerCase() === tx.hash.toLowerCase(),
      ),
    );

  return (
    <div className="flex min-h-0 flex-col items-center gap-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Image src={img} alt="Monarch Agent" width={150} height={150} className="rounded-full" />
      </motion.div>

      <div className="bg-hovered w-full max-w-2xl space-y-6 rounded p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-monospace text-lg">{agent.name}</h3>
            <Link
              href={`https://basescan.org/address/${agent.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface rounded px-2 py-1 font-mono text-xs text-secondary"
            >
              {agent.address.slice(0, 6) + '...' + agent.address.slice(-4)}
            </Link>
          </div>
          <Tooltip
            className="rounded-sm"
            content={
              <TooltipContent
                icon={<GrStatusGood />}
                title="Agent Active"
                detail="Your agent is actively managing your positions"
              />
            }
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-secondary">Active</span>
            </div>
          </Tooltip>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-secondary">Strategy</h4>
            <p className="font-zen">{agent.strategyDescription}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-secondary">Monitoring Positions</h4>
            <div className="flex flex-wrap gap-3">
              {Object.values(loanAssetGroups).map(({ address, chainId, markets: authorizedMarkets }) => {
                const token = findToken(address, chainId);
                return (
                  <div
                    key={address}
                    className="bg-surface flex items-center gap-2 rounded px-3 py-2"
                  >
                    {token?.img && (
                      <Image
                        src={token.img}
                        alt={token.symbol}
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    )}
                    <span className="text-sm">
                      {token?.symbol ?? 'Unknown'} ({authorizedMarkets.length})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-secondary">Last Action</h4>
            <div className="flex items-center gap-4 text-sm">
              {lastTx && (
                <>
                  <Link
                    href={`https://basescan.org/tx/${lastTx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-surface flex items-center gap-2 rounded px-3 py-2 text-sm no-underline"
                  >
                    <span>
                      {' '}
                      {lastTx.hash.slice(0, 6) + '...' + lastTx.hash.slice(-4)}{' '}
                      <span className="text-xs text-secondary">
                        {' '}
                        {moment.unix(lastTx.timestamp).fromNow()}{' '}
                      </span>{' '}
                    </span>
                  </Link>
                  <Link
                    href={`/history/${account}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-surface flex items-center gap-2 rounded px-3 py-2 text-sm no-underline"
                  >
                    <span> View All ({userRebalancerInfo.transactions?.length ?? 0})</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Button size="lg" variant="cta" onPress={onNext}>
        Update Settings
      </Button>
    </div>
  );
}
