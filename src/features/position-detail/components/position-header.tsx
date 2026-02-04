'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { TbArrowsRightLeft } from 'react-icons/tb';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { CollateralIconsDisplay } from '@/features/positions/components/collateral-icons-display';
import { useModalStore } from '@/stores/useModalStore';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';
import { getGroupedEarnings } from '@/utils/positions';
import type { GroupedPosition } from '@/utils/types';

type PositionHeaderProps = {
  groupedPosition?: GroupedPosition;
  chainId: SupportedNetworks;
  userAddress: string;
  allPositions: GroupedPosition[];
  loanAssetAddress: string;
  loanAssetSymbol?: string;
  onRefetch: () => void;
  isRefetching: boolean;
  isLoading: boolean;
  isEarningsLoading: boolean;
  periodLabel: string;
};

export function PositionHeader({
  groupedPosition,
  chainId,
  userAddress,
  allPositions,
  loanAssetAddress,
  loanAssetSymbol,
  onRefetch,
  isRefetching,
  isLoading,
  isEarningsLoading,
  periodLabel,
}: PositionHeaderProps) {
  const router = useRouter();
  const { address } = useConnection();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const { open: openModal } = useModalStore();

  const isOwner = address === userAddress;
  const networkImg = getNetworkImg(chainId);

  const displaySymbol = groupedPosition?.loanAssetSymbol ?? loanAssetSymbol ?? '';

  const handlePositionChange = (position: GroupedPosition) => {
    router.push(`/position/${position.chainId}/${position.loanAssetAddress}/${userAddress}`);
  };

  const handleRebalanceClick = () => {
    if (!groupedPosition) return;
    openModal('rebalance', {
      groupedPosition,
      refetch: onRefetch,
      isRefetching,
    });
  };

  const formattedRate = (() => {
    if (!groupedPosition) return null;
    const rate = groupedPosition.totalWeightedApy;
    const displayRate = isAprDisplay ? convertApyToApr(rate) : rate;
    return `${(displayRate * 100).toFixed(2)}%`;
  })();

  // Actual/realized APY from earnings
  const formattedActualRate = (() => {
    if (!groupedPosition || !groupedPosition.actualApy) return null;
    const rate = groupedPosition.actualApy;
    const displayRate = isAprDisplay ? convertApyToApr(rate) : rate;
    return `${(displayRate * 100).toFixed(2)}%`;
  })();

  const totalSupplyFormatted = groupedPosition ? formatReadable(groupedPosition.totalSupply) : null;

  // Calculate total earnings
  const totalEarnings = groupedPosition ? getGroupedEarnings(groupedPosition) : 0n;
  const earningsFormatted =
    groupedPosition && totalEarnings > 0n ? formatReadable(Number(formatBalance(totalEarnings, groupedPosition.loanAssetDecimals))) : null;

  return (
    <div className="mt-6 mb-6 space-y-4">
      <div className="rounded border border-border bg-surface px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* LEFT: Position Identity */}
          <div className="flex items-center gap-4">
            {/* Token icon with network overlay */}
            <div className="relative">
              <TokenIcon
                address={groupedPosition?.loanAssetAddress ?? loanAssetAddress}
                chainId={chainId}
                symbol={displaySymbol}
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
                      <span>{displaySymbol || <span className="h-6 w-16 animate-pulse rounded bg-hovered inline-block" />}</span>
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
                            pos.loanAssetAddress === (groupedPosition?.loanAssetAddress ?? loanAssetAddress) && pos.chainId === chainId
                              ? 'bg-hovered'
                              : ''
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
              {/* Collaterals in subtitle */}
              {groupedPosition && groupedPosition.collaterals.length > 0 && (
                <div className="mt-1 flex items-center gap-1 text-sm text-secondary">
                  <span>Collaterals:</span>
                  <CollateralIconsDisplay
                    collaterals={groupedPosition.collaterals}
                    chainId={chainId}
                    maxDisplay={5}
                    iconSize={16}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Stats + Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Key Stats */}
            <div className="flex items-center gap-6 border-r border-border pr-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Total Supply</p>
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <div className="h-6 w-20 animate-pulse rounded bg-hovered" />
                  ) : (
                    <>
                      <p className="tabular-nums text-lg">{totalSupplyFormatted}</p>
                      {groupedPosition && (
                        <TokenIcon
                          address={groupedPosition.loanAssetAddress}
                          chainId={chainId}
                          symbol={groupedPosition.loanAssetSymbol}
                          width={18}
                          height={18}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Avg {rateLabel}</p>
                {isLoading ? (
                  <div className="h-6 w-16 animate-pulse rounded bg-hovered" />
                ) : (
                  <p className="tabular-nums text-lg">{formattedRate}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">
                  {rateLabel} ({periodLabel})
                </p>
                {isLoading || isEarningsLoading ? (
                  <div className="h-6 w-16 animate-pulse rounded bg-hovered" />
                ) : formattedActualRate ? (
                  <Tooltip
                    content={
                      <TooltipContent
                        title={`Realized ${rateLabel}`}
                        detail="Annualized yield from interest earned over the period, weighted by your balance over time."
                      />
                    }
                  >
                    <p className="tabular-nums text-lg cursor-help">{formattedActualRate}</p>
                  </Tooltip>
                ) : (
                  <p className="tabular-nums text-lg text-secondary">-</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-secondary">Earned ({periodLabel})</p>
                <div className="flex items-center gap-2">
                  {isLoading || isEarningsLoading ? (
                    <div className="h-6 w-20 animate-pulse rounded bg-hovered" />
                  ) : earningsFormatted ? (
                    <>
                      <p className="tabular-nums text-lg">+{earningsFormatted}</p>
                      {groupedPosition && (
                        <TokenIcon
                          address={groupedPosition.loanAssetAddress}
                          chainId={chainId}
                          symbol={groupedPosition.loanAssetSymbol}
                          width={18}
                          height={18}
                        />
                      )}
                    </>
                  ) : (
                    <p className="tabular-nums text-lg text-secondary">-</p>
                  )}
                </div>
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
                      disabled={isLoading || !groupedPosition}
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
      </div>
    </div>
  );
}
