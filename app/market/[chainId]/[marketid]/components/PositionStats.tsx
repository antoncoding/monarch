import { useState } from 'react';
import { Card } from '@heroui/react';
import { Switch } from '@heroui/react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { FiUser } from 'react-icons/fi';
import { HiOutlineGlobeAsiaAustralia } from 'react-icons/hi2';
import { Spinner } from '@/components/common/Spinner';
import { TokenIcon } from '@/components/TokenIcon';
import { formatBalance, formatReadable } from '@/utils/balance';
import { Market, MarketPosition } from '@/utils/types';

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

export function PositionStats({
  market,
  userPosition,
  positionLoading,
  cardStyle,
  onRefresh,
  isRefreshing = false,
}: PositionStatsProps) {
  // Default to user view if they have a position, otherwise global
  const [viewMode, setViewMode] = useState<'global' | 'user'>(userPosition ? 'user' : 'global');

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
                {market.loanAsset.symbol}
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
                {market.loanAsset.symbol}
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
                {market.collateralAsset.symbol}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Global stats
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
              {market.loanAsset.symbol}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span>Total Collateral:</span>
          <div className="flex items-center gap-2">
            <TokenIcon
              address={market.collateralAsset.address}
              chainId={market.morphoBlue.chain.id}
              symbol={market.collateralAsset.symbol}
              width={16}
              height={16}
            />
            <span>
              {formatReadable(
                formatBalance(
                  BigInt(market.state.collateralAssets || 0),
                  market.collateralAsset.decimals,
                ).toString(),
              )}{' '}
              {market.collateralAsset.symbol}
            </span>
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
