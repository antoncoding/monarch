import { Tooltip } from '@nextui-org/react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { GrStatusGood } from 'react-icons/gr';
import { Button } from '@/components/common';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { useMarkets } from '@/contexts/MarketsContext';
import { getExplorerURL } from '@/utils/external';
import { findAgent } from '@/utils/monarch-agent';
import { getNetworkName } from '@/utils/networks';
import { UserRebalancerInfo } from '@/utils/types';

const img = require('../../../../src/imgs/agent/agent-detailed.png') as string;

type MainProps = {
  onNext: () => void;
  userRebalancerInfos: UserRebalancerInfo[];
};

export function Main({ onNext, userRebalancerInfos }: MainProps) {
  const { markets } = useMarkets();

  const activeAgentInfos = userRebalancerInfos
    .map((info) => ({
      info,
      agent: findAgent(info.rebalancer),
    }))
    .filter((item) => item.agent !== undefined);

  if (activeAgentInfos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p>No active agent found for the configured networks.</p>
        <Button size="lg" variant="light" onPress={onNext}>
          Configure Agent
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Image src={img} alt="Monarch Agent" width={150} height={150} className="rounded-full" />
      </motion.div>

      {activeAgentInfos.map(({ info, agent }) => {
        if (!agent) return null;

        const networkName = getNetworkName(info.network);

        const authorizedMarkets = markets.filter(
          (market) =>
            market.morphoBlue.chain.id === info.network &&
            info.marketCaps.some(
              (cap) => cap.marketId.toLowerCase() === market.uniqueKey.toLowerCase(),
            ),
        );

        const loanAssetGroups = authorizedMarkets.reduce(
          (acc, market) => {
            const address = market.loanAsset.address.toLowerCase();
            if (!acc[address]) {
              acc[address] = {
                address,
                chainId: market.morphoBlue.chain.id,
                markets: [],
                symbol: market.loanAsset.symbol,
              };
            }
            acc[address].markets.push(market);
            return acc;
          },
          {} as Record<
            string,
            { address: string; chainId: number; symbol: string; markets: typeof authorizedMarkets }
          >,
        );

        const explorerUrl = getExplorerURL(agent.address, info.network);

        return (
          <div key={info.network} className="bg-hovered w-full max-w-2xl space-y-6 rounded p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-monospace text-lg">{agent.name}</h3>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                  {networkName}
                </span>
                <Link
                  href={explorerUrl}
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
                    detail={`Agent is active on ${networkName}`}
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
                  {Object.values(loanAssetGroups).map(
                    ({ address, chainId, markets: marketsForLoanAsset, symbol }) => {
                      return (
                        <div
                          key={address}
                          className="bg-surface flex items-center gap-2 rounded px-3 py-2"
                        >
                          <TokenIcon
                            address={address}
                            chainId={chainId}
                            symbol={symbol}
                            width={18}
                            height={18}
                          />
                          <span className="text-sm">
                            {symbol ?? 'Unknown'} ({marketsForLoanAsset.length})
                          </span>
                        </div>
                      );
                    },
                  )}
                  {Object.values(loanAssetGroups).length === 0 && (
                    <p className="text-sm text-secondary">
                      No markets currently configured for this agent.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <Button size="lg" variant="cta" onPress={onNext}>
        Update Settings
      </Button>
    </div>
  );
}
