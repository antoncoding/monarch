import { useState } from 'react';
import { Card } from '@heroui/react';
import { Switch } from '@heroui/react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { FiUser } from 'react-icons/fi';
import { HiOutlineGlobeAsiaAustralia } from 'react-icons/hi2';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarketCampaigns } from '@/hooks/useMarketCampaigns';
import { useMarkets } from '@/hooks/useMarkets';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getTruncatedAssetName } from '@/utils/oracle';
import { Market, MarketPosition } from '@/utils/types';
import { APYBreakdownTooltip } from 'app/markets/components/APYBreakdownTooltip';

type PositionStatsProps = {
  market: Market;
  userPosition: MarketPosition | null;
  positionLoading: boolean;
  cardStyle: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

function ThumbIcon({ isSelected, className }: { isSelected: boolean; className?: string }) {
  return isSelected ? (
    <FiUser className={className} />
  ) : (
    <HiOutlineGlobeAsiaAustralia className={className} />
  );
}

const hasPosition = (position: MarketPosition) => {
  return (
    position.state.borrowAssets !== '0' ||
    position.state.collateral !== '0' ||
    position.state.supplyAssets !== '0'
  );
};

export function PositionStats({
  market,
  userPosition,
  positionLoading,
  cardStyle,
  onRefresh,
  isRefreshing = false,
}: PositionStatsProps) {
  // Default to user view if they have a position, otherwise global
  const [viewMode, setViewMode] = useState<'global' | 'user'>(
    userPosition && hasPosition(userPosition) ? 'user' : 'global',
  );

  const { showFullRewardAPY } = useMarkets();
  const { activeCampaigns, hasActiveRewards } = useMarketCampaigns({
    marketId: market.uniqueKey,
    loanTokenAddress: market.loanAsset.address,
    chainId: market.morphoBlue.chain.id,
  });

  const toggleView = () => {
    setViewMode((prev) => (prev === 'global' ? 'user' : 'global'));
  };

  const renderStats = () => {
    if (viewMode === 'user') {
      if (positionLoading) {
        return (
          <div className="flex justify-center">
            <Spinner size={24} />
          </div>
        );
      }

      if (!userPosition) {
        return <div className="text-center text-gray-500">No active position</div>;
      }

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span>Supply:</span>
            <div className="flex items-center gap-2">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={16}
                height={16}
              />
              <span>
                {formatBalance(
                  BigInt(userPosition.state.supplyAssets || 0),
                  market.loanAsset.decimals,
                ).toString()}{' '}
                {getTruncatedAssetName(market.loanAsset.symbol)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Borrow:</span>
            <div className="flex items-center gap-2">
              <TokenIcon
                address={market.loanAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.loanAsset.symbol}
                width={16}
                height={16}
              />
              <span>
                {formatBalance(
                  BigInt(userPosition.state.borrowAssets || 0),
                  market.loanAsset.decimals,
                ).toString()}{' '}
                {getTruncatedAssetName(market.loanAsset.symbol)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>Collateral:</span>
            <div className="flex items-center gap-2">
              <TokenIcon
                address={market.collateralAsset.address}
                chainId={market.morphoBlue.chain.id}
                symbol={market.collateralAsset.symbol}
                width={16}
                height={16}
              />
              <span>
                {formatBalance(
                  BigInt(userPosition.state.collateral || 0),
                  market.collateralAsset.decimals,
                ).toString()}{' '}
                {getTruncatedAssetName(market.collateralAsset.symbol)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Global stats - calculate APYs
    const baseSupplyAPY = market.state.supplyApy * 100;
    const extraRewards = hasActiveRewards
      ? activeCampaigns.reduce((sum, campaign) => sum + campaign.apr, 0)
      : 0;
    const fullSupplyAPY = baseSupplyAPY + extraRewards;
    const displaySupplyAPY = showFullRewardAPY && hasActiveRewards ? fullSupplyAPY : baseSupplyAPY;

    const borrowAPY = market.state.borrowApy * 100;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span>Total Supply:</span>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
            <span>
              {formatReadable(
                formatBalance(
                  BigInt(market.state.supplyAssets || 0),
                  market.loanAsset.decimals,
                ).toString(),
              )}{' '}
              {market.loanAsset.symbol}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Total Borrow:</span>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.loanAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.loanAsset.symbol}
              width={16}
              height={16}
            />
            <span>
              {formatReadable(
                formatBalance(
                  BigInt(market.state.borrowAssets || 0),
                  market.loanAsset.decimals,
                ).toString(),
              )}{' '}
              {getTruncatedAssetName(market.loanAsset.symbol)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Supply APY:</span>
          <div className="flex items-center gap-2">
            {hasActiveRewards ? (
              <APYBreakdownTooltip
                baseAPY={baseSupplyAPY}
                activeCampaigns={activeCampaigns}
                fullAPY={fullSupplyAPY}
              >
                <span className="cursor-help">
                  {baseSupplyAPY.toFixed(2)}%
                  <span className="text-green-600 dark:text-green-400">
                    {' '}
                    (+{extraRewards.toFixed(2)}%)
                  </span>
                </span>
              </APYBreakdownTooltip>
            ) : (
              <span>{displaySupplyAPY.toFixed(2)}%</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Borrow APY:</span>
          <div className="flex items-center gap-2">
            <span>{borrowAPY.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className={cardStyle}>
      <div className="flex items-center justify-between p-4 py-3">
        <span className="text-xl">{viewMode === 'global' ? 'Global Stats' : 'Your Position'}</span>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-full p-1 transition-opacity hover:opacity-70"
              disabled={isRefreshing}
              aria-label="Refresh position and market data"
            >
              <ReloadIcon className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Switch
            defaultSelected={viewMode === 'user'}
            size="sm"
            color="primary"
            classNames={{
              wrapper: 'mx-0',
              thumbIcon: 'p-0 mr-0',
            }}
            onChange={toggleView}
            thumbIcon={ThumbIcon}
          />
        </div>
      </div>
      <div className="px-4 py-3">{renderStats()}</div>
    </Card>
  );
}
