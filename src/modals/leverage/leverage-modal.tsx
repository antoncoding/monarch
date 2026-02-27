import { useCallback, useEffect, useMemo, useState } from 'react';
import { getChainAddresses } from '@morpho-org/blue-sdk';
import { type Address, erc20Abi, isAddressEqual, zeroAddress } from 'viem';
import { useConnection, useReadContract, useReadContracts } from 'wagmi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ModalIntentSwitcher } from '@/components/common/Modal/ModalIntentSwitcher';
import { TokenIcon } from '@/components/shared/token-icon';
import { Badge } from '@/components/ui/badge';
import { erc4626Abi } from '@/abis/erc4626';
import type { LeverageRoute, SwapLeverageRoute } from '@/hooks/leverage/types';
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
  const [routeMode, setRouteMode] = useState<'swap' | 'erc4626'>('swap');
  const { address: account } = useConnection();

  const swapRoute = useMemo<SwapLeverageRoute | null>(() => {
    try {
      const chainAddresses = getChainAddresses(market.morphoBlue.chain.id);
      const bundler3Addresses = chainAddresses?.bundler3;
      if (!bundler3Addresses?.bundler3 || !bundler3Addresses.generalAdapter1 || !bundler3Addresses.paraswapAdapter) {
        return null;
      }

      return {
        kind: 'swap',
        bundler3Address: bundler3Addresses.bundler3 as Address,
        generalAdapterAddress: bundler3Addresses.generalAdapter1 as Address,
        paraswapAdapterAddress: bundler3Addresses.paraswapAdapter as Address,
      };
    } catch {
      return null;
    }
  }, [market.morphoBlue.chain.id]);

  const {
    data: erc4626ProbeData,
    isLoading: isErc4626ProbeLoading,
    isRefetching: isErc4626ProbeRefetching,
  } = useReadContracts({
    contracts: [
      {
        address: market.collateralAsset.address as Address,
        abi: erc4626Abi,
        functionName: 'asset',
        args: [],
        chainId: market.morphoBlue.chain.id,
      },
    ],
    allowFailure: true,
    query: {
      enabled: !!market.collateralAsset.address && market.collateralAsset.address !== zeroAddress,
    },
  });

  const isErc4626ModeAvailable = useMemo(() => {
    const erc4626Asset = erc4626ProbeData?.[0]?.result as Address | undefined;
    return !!erc4626Asset && erc4626Asset !== zeroAddress && isAddressEqual(erc4626Asset, market.loanAsset.address as Address);
  }, [erc4626ProbeData, market.loanAsset.address]);

  const availableRouteModes = useMemo<Array<'swap' | 'erc4626'>>(() => {
    const modes: Array<'swap' | 'erc4626'> = [];
    if (swapRoute) modes.push('swap');
    if (isErc4626ModeAvailable) modes.push('erc4626');
    return modes;
  }, [swapRoute, isErc4626ModeAvailable]);

  useEffect(() => {
    if (availableRouteModes.length === 0) return;
    if (!availableRouteModes.includes(routeMode)) {
      setRouteMode(availableRouteModes[0]);
    }
  }, [availableRouteModes, routeMode]);

  const route = useMemo<LeverageRoute | null>(() => {
    if (routeMode === 'erc4626' && isErc4626ModeAvailable) {
      return {
        kind: 'erc4626',
        collateralVault: market.collateralAsset.address as Address,
        underlyingLoanToken: market.loanAsset.address as Address,
      };
    }

    return swapRoute;
  }, [routeMode, isErc4626ModeAvailable, market.collateralAsset.address, market.loanAsset.address, swapRoute]);
  const isErc4626Route = route?.kind === 'erc4626';
  const isSwapRoute = route?.kind === 'swap';
  const routeModeOptions: { value: string; label: string }[] = availableRouteModes.map((value) => ({
    value,
    label: value === 'swap' ? 'Swap' : 'ERC4626',
  }));

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
            {isErc4626Route && (
              <Badge
                variant="success"
                size="sm"
                className="uppercase tracking-[0.08em]"
              >
                #ERC4626
              </Badge>
            )}
            {isSwapRoute && (
              <Badge
                variant="warning"
                size="sm"
                className="uppercase tracking-[0.08em]"
              >
                #SWAP
              </Badge>
            )}
            {routeModeOptions.length > 1 && (
              <ModalIntentSwitcher
                value={routeMode}
                options={routeModeOptions}
                onValueChange={(nextRouteMode) => setRouteMode(nextRouteMode as 'swap' | 'erc4626')}
                className="text-xs text-secondary"
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
