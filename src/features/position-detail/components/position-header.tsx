'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { TbArrowsRightLeft } from 'react-icons/tb';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/components/shared/token-icon';
import { AccountIdentity } from '@/components/shared/account-identity';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useModalStore } from '@/stores/useModalStore';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';
import type { GroupedPosition } from '@/utils/types';

type PositionHeaderProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  userAddress: string;
  allPositions: GroupedPosition[];
  onRefetch: () => void;
  isRefetching: boolean;
};

export function PositionHeader({ groupedPosition, chainId, userAddress, allPositions, onRefetch, isRefetching }: PositionHeaderProps) {
  const router = useRouter();
  const { address } = useConnection();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const { open: openModal } = useModalStore();

  const isOwner = address === userAddress;
  const networkImg = getNetworkImg(chainId);

  const handlePositionChange = (position: GroupedPosition) => {
    router.push(`/position/${position.chainId}/${position.loanAssetSymbol}/${userAddress}`);
  };

  const handleRebalanceClick = () => {
    openModal('rebalance', {
      groupedPosition,
      refetch: onRefetch,
      isRefetching,
    });
  };

  const formattedRate = (() => {
    const rate = groupedPosition.totalWeightedApy;
    const displayRate = isAprDisplay ? convertApyToApr(rate) : rate;
    return `${(displayRate * 100).toFixed(2)}%`;
  })();

  // Calculate total value in USD if we had price data
  const totalSupplyFormatted = formatReadable(groupedPosition.totalSupply);

  return (
    <div className="mt-6 mb-6 space-y-4">
      <div className="rounded border border-border bg-surface px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* LEFT: Position Identity */}
          <div className="flex items-center gap-4">
            {/* Token icon with network overlay */}
            <div className="relative">
              <TokenIcon
                address={groupedPosition.loanAssetAddress}
                chainId={chainId}
                symbol={groupedPosition.loanAssetSymbol}
                width={48}
                height={48}
              />
              {networkImg && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5">
                  <Image
                    src={networkImg}
                    alt={getNetworkName(chainId) ?? `Chain ${chainId}`}
                    width={16}
                    height={16}
                  />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 pt-2">
                {/* Position Switcher */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-2xl hover:text-primary transition-colors"
                    >
                      <span>{groupedPosition.loanAssetSymbol}</span>
                      <span className="text-secondary">Position</span>
                      {allPositions.length > 1 && <ChevronDownIcon className="h-5 w-5 text-secondary" />}
                    </button>
                  </DropdownMenuTrigger>
                  {allPositions.length > 1 && (
                    <DropdownMenuContent align="start">
                      {allPositions.map((pos) => (
                        <DropdownMenuItem
                          key={`${pos.loanAssetAddress}-${pos.chainId}`}
                          onClick={() => handlePositionChange(pos)}
                          className={
                            pos.loanAssetAddress === groupedPosition.loanAssetAddress && pos.chainId === chainId ? 'bg-hovered' : ''
                          }
                        >
                          <div className="flex items-center gap-2">
                            <TokenIcon
                              address={pos.loanAssetAddress}
                              chainId={pos.chainId}
                              symbol={pos.loanAssetSymbol}
                              width={20}
                              height={20}
                            />
                            <span>{pos.loanAssetSymbol}</span>
                            <span className="badge text-xs">
                              <Image
                                src={getNetworkImg(pos.chainId) ?? ''}
                                alt={getNetworkName(pos.chainId) ?? `Chain ${pos.chainId}`}
                                width={12}
                                height={12}
                              />
                              <span>{getNetworkName(pos.chainId) ?? `Chain ${pos.chainId}`}</span>
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
                {networkImg && (
                  <div className="flex items-center gap-1">
                    <Image
                      src={networkImg}
                      alt={chainId.toString()}
                      width={14}
                      height={14}
                    />
                    <span>{getNetworkName(chainId)}</span>
                  </div>
                )}
                <span className="text-border">·</span>
                <span>
                  {groupedPosition.markets.length} Market{groupedPosition.markets.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Stats + Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Key Stats */}
            <div className="hidden lg:flex items-center gap-6 border-r border-border pr-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Total Supply</p>
                <div className="flex items-center gap-2">
                  <p className="tabular-nums text-lg">{totalSupplyFormatted}</p>
                  <TokenIcon
                    address={groupedPosition.loanAssetAddress}
                    chainId={chainId}
                    symbol={groupedPosition.loanAssetSymbol}
                    width={18}
                    height={18}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Avg {rateLabel}</p>
                <p className="tabular-nums text-lg">{formattedRate}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isOwner && (
                <Tooltip
                  content={
                    <TooltipContent
                      title="Rebalance"
                      detail="Rebalance your position across markets"
                    />
                  }
                >
                  <span>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleRebalanceClick}
                    >
                      <TbArrowsRightLeft className="h-4 w-4" />
                      Rebalance
                    </Button>
                  </span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Stats Row */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 lg:hidden">
          <div>
            <p className="text-xs text-secondary">Total Supply</p>
            <div className="flex items-center gap-1">
              <p className="tabular-nums">{totalSupplyFormatted}</p>
              <TokenIcon
                address={groupedPosition.loanAssetAddress}
                chainId={chainId}
                symbol={groupedPosition.loanAssetSymbol}
                width={14}
                height={14}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-secondary">Avg {rateLabel}</p>
            <p className="tabular-nums">{formattedRate}</p>
          </div>
        </div>

        {/* Account Identity Row */}
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">Account:</span>
              <AccountIdentity
                address={userAddress as `0x${string}`}
                chainId={chainId}
                variant="compact"
              />
            </div>
            {isOwner && <span className="badge text-xs text-green-500">Your Position</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
