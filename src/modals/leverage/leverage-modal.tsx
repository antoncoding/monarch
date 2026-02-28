import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { type Address, erc20Abi } from 'viem';
import { useConnection, useReadContract } from 'wagmi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
import { TokenIcon } from '@/components/shared/token-icon';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLeverageRouteAvailability } from '@/hooks/leverage/useLeverageRouteAvailability';
import type { LeverageRoute } from '@/hooks/leverage/types';
import { cn } from '@/utils/components';
import type { Market, MarketPosition } from '@/utils/types';
import { AddCollateralAndLeverage } from './components/add-collateral-and-leverage';
import { RemoveCollateralAndDeleverage } from './components/remove-collateral-and-deleverage';

type LeverageModalProps = {
  market: Market;
  onOpenChange: (open: boolean) => void;
  oraclePrice: bigint;
  refetch?: () => void;
  isRefreshing?: boolean;
  position: MarketPosition | null;
  defaultMode?: 'leverage' | 'deleverage';
  toggleLeverageDeleverage?: boolean;
};

const ROUTE_MODE_LABELS = {
  erc4626: 'ERC4626',
  swap: 'SWAP',
} as const;

const ROUTE_MODE_BADGE_VARIANTS = {
  erc4626: 'success',
  swap: 'warning',
} as const;

type RouteMode = keyof typeof ROUTE_MODE_LABELS;

type RouteModeBadgeProps = {
  value: RouteMode;
  availableModes: RouteMode[];
  onValueChange: (value: RouteMode) => void;
};

function RouteModeBadge({ value, availableModes, onValueChange }: RouteModeBadgeProps): JSX.Element {
  const canSwitch = availableModes.length > 1;
  const label = ROUTE_MODE_LABELS[value];
  const badge = (
    <Badge
      variant={ROUTE_MODE_BADGE_VARIANTS[value]}
      size="sm"
      className={cn('uppercase tracking-[0.08em]', canSwitch && 'gap-1')}
    >
      <span>#{label}</span>
      {canSwitch && <ChevronDownIcon className="h-3.5 w-3.5" />}
    </Badge>
  );

  if (!canSwitch) {
    return badge;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
        >
          {badge}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-[3600] min-w-[10rem] p-1"
      >
        {availableModes.map((mode) => (
          <DropdownMenuItem
            key={mode}
            onClick={() => onValueChange(mode)}
            className={cn(mode === value && 'bg-hovered')}
          >
            {ROUTE_MODE_LABELS[mode]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LeverageModal({
  market,
  onOpenChange,
  oraclePrice,
  refetch,
  isRefreshing = false,
  position,
  defaultMode = 'leverage',
  toggleLeverageDeleverage = true,
}: LeverageModalProps): JSX.Element {
  const [mode, setMode] = useState<'leverage' | 'deleverage'>(defaultMode);
  const [routeMode, setRouteMode] = useState<RouteMode>('erc4626');
  const { address: account } = useConnection();

  const { swapRoute, isErc4626ModeAvailable, availableRouteModes, isErc4626ProbeLoading, isErc4626ProbeRefetching } =
    useLeverageRouteAvailability({
      chainId: market.morphoBlue.chain.id,
      collateralTokenAddress: market.collateralAsset.address,
      loanTokenAddress: market.loanAsset.address,
    });

  useEffect(() => {
    if (availableRouteModes.length === 0) return;
    if (availableRouteModes.includes(routeMode)) return;

    const waitingForErc4626Availability =
      routeMode === 'erc4626' && !isErc4626ModeAvailable && (isErc4626ProbeLoading || isErc4626ProbeRefetching);
    if (waitingForErc4626Availability) return;

    setRouteMode(availableRouteModes[0]);
  }, [availableRouteModes, routeMode, isErc4626ModeAvailable, isErc4626ProbeLoading, isErc4626ProbeRefetching]);

  const route = useMemo<LeverageRoute | null>(() => {
    if (routeMode === 'erc4626') {
      if (isErc4626ModeAvailable) {
        return {
          kind: 'erc4626',
          collateralVault: market.collateralAsset.address as Address,
          underlyingLoanToken: market.loanAsset.address as Address,
        };
      }
      if (isErc4626ProbeLoading || isErc4626ProbeRefetching) return null;
      return swapRoute;
    }

    return swapRoute;
  }, [
    routeMode,
    isErc4626ModeAvailable,
    isErc4626ProbeLoading,
    isErc4626ProbeRefetching,
    market.collateralAsset.address,
    market.loanAsset.address,
    swapRoute,
  ]);
  const isErc4626Route = route?.kind === 'erc4626';
  const isSwapRoute = route?.kind === 'swap';
  const displayedRouteMode = useMemo<RouteMode>(() => {
    if (route?.kind) return route.kind;
    if (availableRouteModes.length === 1) return availableRouteModes[0];
    if (availableRouteModes.includes(routeMode)) return routeMode;
    return availableRouteModes[0] ?? routeMode;
  }, [route, availableRouteModes, routeMode]);

  const effectiveMode = mode;
  const modeOptions: { value: string; label: string }[] = toggleLeverageDeleverage
    ? [
        { value: 'leverage', label: `Leverage ${market.collateralAsset.symbol}` },
        { value: 'deleverage', label: `Deleverage ${market.collateralAsset.symbol}` },
      ]
    : [
        {
          value: effectiveMode,
          label: effectiveMode === 'leverage' ? `Leverage ${market.collateralAsset.symbol}` : `Deleverage ${market.collateralAsset.symbol}`,
        },
      ];

  const {
    data: collateralTokenBalance,
    refetch: refetchCollateralTokenBalance,
    isFetching: isFetchingCollateralTokenBalance,
  } = useReadContract({
    address: market.collateralAsset.address as `0x${string}`,
    args: [account as `0x${string}`],
    functionName: 'balanceOf',
    abi: erc20Abi,
    chainId: market.morphoBlue.chain.id,
    query: {
      enabled: !!account,
    },
  });

  const handleRefreshAll = useCallback(() => {
    const tasks: Promise<unknown>[] = [];
    if (refetch) tasks.push(Promise.resolve(refetch()));
    if (account) tasks.push(refetchCollateralTokenBalance());
    if (tasks.length > 0) void Promise.allSettled(tasks);
  }, [refetch, account, refetchCollateralTokenBalance]);

  const isRefreshingAnyData = isRefreshing || isFetchingCollateralTokenBalance;

  const mainIcon = (
    <div className="flex -space-x-2">
      <TokenIcon
        address={market.loanAsset.address}
        chainId={market.morphoBlue.chain.id}
        symbol={market.loanAsset.symbol}
        width={24}
        height={24}
      />
      <div className="rounded-full border border-gray-800">
        <TokenIcon
          address={market.collateralAsset.address}
          chainId={market.morphoBlue.chain.id}
          symbol={market.collateralAsset.symbol}
          width={24}
          height={24}
        />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
    >
      <ModalHeader
        mainIcon={mainIcon}
        onClose={() => onOpenChange(false)}
        title={
          <div className="flex items-center gap-2">
            <ModalIntentSwitcher
              value={effectiveMode}
              options={modeOptions}
              onValueChange={(nextMode) => setMode(nextMode as 'leverage' | 'deleverage')}
            />
            {(route || availableRouteModes.length > 0) && (
              <RouteModeBadge
                value={displayedRouteMode}
                availableModes={availableRouteModes}
                onValueChange={setRouteMode}
              />
            )}
          </div>
        }
        description={
          effectiveMode === 'leverage'
            ? isErc4626Route
              ? `Leverage ERC4626 vault exposure by looping ${market.loanAsset.symbol} into ${market.collateralAsset.symbol}.`
              : isSwapRoute
                ? `Leverage ${market.collateralAsset.symbol} exposure through Bundler3 + Velora swap routing.`
                : `Leverage your ${market.collateralAsset.symbol} exposure by looping.`
            : isErc4626Route
              ? `Reduce ERC4626 leveraged exposure by unwinding your ${market.collateralAsset.symbol} loop.`
              : isSwapRoute
                ? `Reduce leveraged exposure by swapping withdrawn ${market.collateralAsset.symbol} back into ${market.loanAsset.symbol} via Bundler3 + Velora.`
                : `Reduce leveraged ${market.collateralAsset.symbol} exposure by unwinding your loop.`
        }
      />
      <ModalBody>
        {route ? (
          effectiveMode === 'leverage' ? (
            <AddCollateralAndLeverage
              market={market}
              route={route}
              currentPosition={position}
              collateralTokenBalance={collateralTokenBalance}
              oraclePrice={oraclePrice}
              onSuccess={handleRefreshAll}
              isRefreshing={isRefreshingAnyData}
            />
          ) : (
            <RemoveCollateralAndDeleverage
              market={market}
              route={route}
              currentPosition={position}
              oraclePrice={oraclePrice}
              onSuccess={handleRefreshAll}
              isRefreshing={isRefreshingAnyData}
            />
          )
        ) : isErc4626ProbeLoading || isErc4626ProbeRefetching ? (
          <div className="rounded border border-white/10 bg-hovered p-4 text-sm text-secondary">Checking available leverage routes...</div>
        ) : (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Swap route configuration is unavailable for this network.
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
