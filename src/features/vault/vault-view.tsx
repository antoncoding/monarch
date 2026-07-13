'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { Button } from '@/components/ui/button';
import Header from '@/components/layout/header/Header';
import { VaultInitializationModal } from '@/features/autovault/components/vault-detail/modals/vault-initialization-modal';
import { VaultSettingsModal } from '@/features/autovault/components/vault-detail/modals/vault-settings';
import { VaultHeader } from '@/features/autovault/components/vault-detail/vault-header';
import {
  VaultAnalyticsPeriodControl,
  vaultAnalyticsPeriodToTimeframe,
  vaultAnalyticsTimeframeToEarningsPeriod,
} from '@/features/vault/components/vault-analytics-period-control';
import { VaultAdapterPositionOverview } from '@/features/vault/components/vault-adapter-position-overview';
import { VaultSharePriceChart } from '@/features/vault/components/vault-share-price-chart';
import { useModal } from '@/hooks/useModal';
import { type VaultMarketAdapter, useMorphoMarketAdapters } from '@/hooks/useMorphoMarketAdapters';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useVaultV2RewardsQuery } from '@/hooks/queries/useVaultV2RewardsQuery';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useVaultAllocations } from '@/hooks/useVaultAllocations';
import { useVaultPage } from '@/hooks/useVaultPage';
import { useVaultQueryRefresh } from '@/hooks/useVaultQueryRefresh';
import { useVaultV2 } from '@/hooks/useVaultV2';
import { useVaultV2Data } from '@/hooks/useVaultV2Data';
import { useAppSettings } from '@/stores/useAppSettings';
import { useVaultInitializationModalStore } from '@/stores/vault-initialization-modal-store';
import { useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { useVaultSettingsModalStore } from '@/stores/vault-settings-modal-store';
import { formatBalance } from '@/utils/balance';
import { getSlicedAddress } from '@/utils/address';
import { getVaultURL, supportsMorphoAppLinks } from '@/utils/external';
import { parseCapIdParams } from '@/utils/morpho';
import { groupPositionsByLoanAsset, processCollaterals } from '@/utils/positions';
import { convertAprToApy, formatRateAsPercentage, toDisplayRateFromApy } from '@/utils/rateMath';
import { ALL_SUPPORTED_NETWORKS, getNetworkConfig, SupportedNetworks } from '@/utils/networks';
import { formatVaultAdapterType } from '@/utils/vaults';

type VaultAdapterPositionDetailProps = {
  adapterAddress?: Address;
  adapterType?: string;
  assetAddress?: Address;
  chainId: SupportedNetworks;
  isResolvingAdapter: boolean;
  period: EarningsPeriod;
  showAdapterLabel?: boolean;
  totalAssets?: bigint;
  vaultAddress: Address;
};

type VaultAdaptersPositionDetailProps = Omit<VaultAdapterPositionDetailProps, 'adapterAddress' | 'adapterType' | 'showAdapterLabel'> & {
  adapters: VaultMarketAdapter[];
};

function VaultStatusPanel({ message }: { message: string }) {
  return <div className="rounded border border-border bg-surface px-6 py-10 text-center text-sm text-secondary shadow-sm">{message}</div>;
}

function VaultPositionLoadingState() {
  const marketPlaceholders = ['market-1', 'market-2', 'market-3'];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="h-8 w-[110px] animate-pulse rounded bg-hovered" />
      </div>
      <div className="rounded border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 h-4 w-36 animate-pulse rounded bg-hovered" />
        <div className="h-52 animate-pulse rounded bg-hovered/70" />
      </div>
      <div className="rounded border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="h-4 w-40 animate-pulse rounded bg-hovered" />
        </div>
        <div className="divide-y divide-border">
          {marketPlaceholders.map((key) => (
            <div
              key={key}
              className="flex items-center gap-4 px-4 py-3"
            >
              <div className="h-8 w-48 animate-pulse rounded bg-hovered" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded bg-hovered" />
              <div className="h-4 w-20 animate-pulse rounded bg-hovered" />
              <div className="h-7 w-20 animate-pulse rounded bg-hovered" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VaultAdapterPositionDetail({
  adapterAddress,
  adapterType,
  assetAddress,
  chainId,
  isResolvingAdapter,
  period,
  showAdapterLabel = false,
  totalAssets,
  vaultAddress,
}: VaultAdapterPositionDetailProps) {
  const hasAdapterPositionTarget = Boolean(adapterAddress && assetAddress);
  const { marketAllocations, loading: marketHintsLoading } = useVaultAllocations({
    vaultAddress,
    chainId,
    enabled: hasAdapterPositionTarget,
  });
  const marketHints = useMemo(
    () =>
      marketAllocations.map((allocation) => ({
        marketUniqueKey: allocation.market.uniqueKey,
        chainId: allocation.market.morphoBlue.chain.id,
        market: allocation.market,
      })),
    [marketAllocations],
  );

  const { positions, isPositionsLoading, isEarningsLoading, actualBlockData, snapshotsByChain } = useUserPositionsSummaryData(
    adapterAddress,
    period,
    [chainId],
    {
      enabled: hasAdapterPositionTarget && marketHints.length > 0,
      marketHints,
      showEmpty: true,
    },
  );

  const groupedPositions = useMemo(() => {
    const grouped = groupPositionsByLoanAsset(positions ?? [], actualBlockData);
    return processCollaterals(grouped);
  }, [positions, actualBlockData]);

  const currentPosition = useMemo(() => {
    if (!assetAddress) return undefined;
    return groupedPositions.find(
      (position) => position.chainId === chainId && position.loanAssetAddress.toLowerCase() === assetAddress.toLowerCase(),
    );
  }, [assetAddress, chainId, groupedPositions]);

  if (!adapterAddress && !isResolvingAdapter) {
    return <VaultStatusPanel message="No connected vault adapter found for this vault." />;
  }

  const isLoading = isResolvingAdapter || marketHintsLoading || isPositionsLoading;

  if (!isLoading && !currentPosition) {
    return null;
  }

  return (
    <>
      {isLoading && !currentPosition && <VaultPositionLoadingState />}

      {currentPosition && adapterAddress && (
        <div className="space-y-3">
          {showAdapterLabel && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
              <span className="uppercase tracking-wider">{formatVaultAdapterType(adapterType)}</span>
              <span className="rounded-sm bg-hovered px-2 py-1 font-mono">{getSlicedAddress(adapterAddress)}</span>
            </div>
          )}
          <VaultAdapterPositionOverview
            groupedPosition={currentPosition}
            chainId={chainId}
            adapterAddress={adapterAddress}
            isEarningsLoading={isEarningsLoading}
            actualBlockData={actualBlockData}
            period={period}
            snapshotsByChain={snapshotsByChain}
            marketAllocations={marketAllocations}
            assetAddress={assetAddress}
            totalAssets={totalAssets}
          />
        </div>
      )}
    </>
  );
}

function VaultAdaptersPositionDetail({ adapters, ...props }: VaultAdaptersPositionDetailProps) {
  if (adapters.length === 0) {
    return (
      <VaultAdapterPositionDetail
        {...props}
        adapterAddress={undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      {adapters.map((adapter) => (
        <VaultAdapterPositionDetail
          key={adapter.id}
          {...props}
          adapterAddress={adapter.adapter}
          adapterType={adapter.adapterType}
          showAdapterLabel={adapters.length > 1}
        />
      ))}
    </div>
  );
}

export default function VaultContent() {
  const { chainId: chainIdParam, vaultAddress } = useParams<{
    chainId: string;
    vaultAddress: string;
  }>();
  const vaultAddressValue = vaultAddress as Address;
  const { address } = useConnection();
  const [hasMounted, setHasMounted] = useState(false);
  const { open: openModal } = useModal();
  const { findToken } = useTokensQuery();
  const { showFullRewardAPY, isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const selectedAnalyticsTimeframe = useMarketDetailChartState((state) => state.selectedTimeframe);
  const setAnalyticsTimeframe = useMarketDetailChartState((state) => state.setTimeframe);
  const analyticsPeriod = vaultAnalyticsTimeframeToEarningsPeriod[selectedAnalyticsTimeframe];

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleAnalyticsPeriodChange = useCallback(
    (period: typeof analyticsPeriod) => {
      setAnalyticsTimeframe(vaultAnalyticsPeriodToTimeframe[period]);
    },
    [setAnalyticsTimeframe],
  );

  const connectedAddress = hasMounted ? address : undefined;

  const chainId = useMemo(() => {
    const parsed = Number(chainIdParam);
    if (Number.isFinite(parsed) && ALL_SUPPORTED_NETWORKS.includes(parsed as SupportedNetworks)) {
      return parsed as SupportedNetworks;
    }
    return SupportedNetworks.Base;
  }, [chainIdParam]);

  const networkConfig = useMemo(() => {
    try {
      return getNetworkConfig(chainId);
    } catch (_error) {
      return null;
    }
  }, [chainId]);

  const vaultDataQuery = useVaultV2Data({ vaultAddress: vaultAddressValue, chainId });
  const {
    data: vaultRewardsData,
    refetch: refetchVaultRewards,
    isRefetching: isRefetchingVaultRewards,
  } = useVaultV2RewardsQuery({ vaultAddress: vaultAddressValue, chainId });
  const vaultContract = useVaultV2({
    vaultAddress: vaultAddressValue,
    chainId,
    connectedAddress,
    onTransactionSuccess: vaultDataQuery.refetch,
  });
  const adapterQuery = useMorphoMarketAdapters({ vaultAddress: vaultAddressValue, chainId });
  const { vaultAPY, isVaultInitialized, needsInitialization } = useVaultPage({
    vaultAddress: vaultAddressValue,
    chainId,
    connectedAddress,
  });
  const { refetch: refetchVaultQueries, isRefetching: isRefetchingVaultQueries } = useVaultQueryRefresh({
    vaultAddress: vaultAddressValue,
    chainId,
  });

  const handleRefreshVault = useCallback(() => {
    void vaultContract.refetch();
    void refetchVaultRewards();
    void refetchVaultQueries({ includeRetries: true });
  }, [refetchVaultQueries, refetchVaultRewards, vaultContract]);

  const vaultData = vaultDataQuery.data;
  const hasError = vaultDataQuery.isError;
  const vaultDataLoading = vaultDataQuery.isLoading;
  const title = vaultData?.displayName || `Vault ${getSlicedAddress(vaultAddressValue)}`;
  const symbolToDisplay = vaultData?.displaySymbol;
  const tokenDecimals = vaultData?.tokenDecimals;
  const tokenSymbol = vaultData?.tokenSymbol;
  const assetAddress = vaultData?.assetAddress as Address | undefined;
  const positionAdapters = adapterQuery.configuredAdapters.length > 0 ? adapterQuery.configuredAdapters : adapterQuery.adapters;
  const adapterAddress = positionAdapters[0]?.adapter ?? adapterQuery.primaryAdapter;
  const morphoVaultHref = useMemo(() => {
    if (!supportsMorphoAppLinks(chainId)) return undefined;
    return getVaultURL(vaultAddressValue, chainId);
  }, [chainId, vaultAddressValue]);

  const { open: openSettings } = useVaultSettingsModalStore();
  const { open: openInitialization } = useVaultInitializationModalStore();

  const hasNoAllocators = Boolean(vaultData?.capsData) && (vaultData?.allocators ?? []).length === 0;
  const capsUninitialized = vaultData?.capsData?.needSetupCaps === true;

  const isRefetching =
    vaultDataQuery.isRefetching ||
    vaultContract.isRefetching ||
    adapterQuery.isRefetching ||
    isRefetchingVaultQueries ||
    isRefetchingVaultRewards;

  const vaultRewardRows = useMemo(
    () =>
      (vaultRewardsData?.rewards ?? [])
        .filter((reward) => Number.isFinite(reward.supplyApr) && reward.supplyApr > 0)
        .map((reward) => ({
          assetAddress: reward.asset.address,
          assetSymbol: reward.asset.symbol,
          rate: isAprDisplay ? reward.supplyApr : convertAprToApy(reward.supplyApr),
        })),
    [isAprDisplay, vaultRewardsData?.rewards],
  );

  const vaultRewardRate = useMemo(() => vaultRewardRows.reduce((sum, reward) => sum + reward.rate, 0), [vaultRewardRows]);
  const baseVaultApy = vaultRewardsData?.apy ?? vaultAPY;
  const baseVaultRate = useMemo(() => {
    if (baseVaultApy === null || baseVaultApy === undefined) return null;
    return toDisplayRateFromApy(baseVaultApy, isAprDisplay);
  }, [baseVaultApy, isAprDisplay]);

  const displayedVaultRate = useMemo(() => {
    if (baseVaultRate === null || baseVaultRate === undefined) {
      return null;
    }

    return showFullRewardAPY && vaultRewardRows.length > 0 ? baseVaultRate + vaultRewardRate : baseVaultRate;
  }, [baseVaultRate, showFullRewardAPY, vaultRewardRate, vaultRewardRows.length]);

  const apyLabel = useMemo(() => {
    if (displayedVaultRate === null || displayedVaultRate === undefined) return '0%';
    return `${(displayedVaultRate * 100).toFixed(2)}%`;
  }, [displayedVaultRate]);

  const baseRateLabel = useMemo(() => {
    if (baseVaultRate === null || baseVaultRate === undefined) return undefined;
    return formatRateAsPercentage(baseVaultRate);
  }, [baseVaultRate]);

  const totalAssetsLabel = useMemo(() => {
    if (vaultContract.totalAssets === undefined || tokenDecimals === undefined) return '--';

    try {
      const numericAssets = formatBalance(vaultContract.totalAssets, tokenDecimals);
      const formattedAssets = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(numericAssets);

      return `${formattedAssets}${tokenSymbol ? ` ${tokenSymbol}` : ''}`.trim();
    } catch (_error) {
      return '--';
    }
  }, [tokenDecimals, tokenSymbol, vaultContract.totalAssets]);

  const userShareBalanceLabel = useMemo(() => {
    if (vaultContract.userAssets === undefined || tokenDecimals === undefined || vaultContract.userAssets === 0n) return undefined;
    try {
      const numericAssets = formatBalance(vaultContract.userAssets, tokenDecimals);
      const formattedAssets = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(numericAssets);
      return `${formattedAssets}${tokenSymbol ? ` ${tokenSymbol}` : ''}`.trim();
    } catch (_error) {
      return undefined;
    }
  }, [tokenDecimals, tokenSymbol, vaultContract.userAssets]);

  const collateralAddresses = useMemo(() => {
    return (vaultData?.capsData?.collateralCaps ?? [])
      .map((cap) => {
        const collateralToken = parseCapIdParams(cap.idParams).collateralToken;
        if (!collateralToken) return null;
        const token = findToken(collateralToken, chainId);
        return {
          address: collateralToken,
          symbol: token?.symbol ?? 'Unknown',
          amount: 1,
        };
      })
      .filter((collateral): collateral is { address: Address; symbol: string; amount: number } => !!collateral);
  }, [vaultData?.capsData?.collateralCaps, findToken, chainId]);

  const handleDeposit = useCallback(() => {
    if (!assetAddress || !tokenSymbol || tokenDecimals === undefined) return;

    openModal('vaultDeposit', {
      vaultAddress: vaultAddressValue,
      vaultName: title,
      assetAddress,
      assetSymbol: tokenSymbol,
      assetDecimals: tokenDecimals,
      chainId,
      onSuccess: handleRefreshVault,
    });
  }, [assetAddress, tokenSymbol, tokenDecimals, vaultAddressValue, title, chainId, openModal, handleRefreshVault]);

  const handleWithdraw = useCallback(() => {
    if (!assetAddress || !tokenSymbol || tokenDecimals === undefined) return;

    openModal('vaultWithdraw', {
      vaultAddress: vaultAddressValue,
      vaultName: title,
      assetAddress,
      assetSymbol: tokenSymbol,
      assetDecimals: tokenDecimals,
      chainId,
      onSuccess: handleRefreshVault,
    });
  }, [assetAddress, tokenSymbol, tokenDecimals, vaultAddressValue, title, chainId, openModal, handleRefreshVault]);

  if (hasError) {
    return (
      <div className="flex w-full flex-col font-zen">
        <Header />
        <div className="container h-full px-[4%] py-12">
          <div className="mb-6">
            <Breadcrumbs items={[{ label: 'Vault' }, { label: `Vault ${getSlicedAddress(vaultAddressValue)}`, isCurrent: true }]} />
          </div>
          <div className="mx-auto max-w-md rounded bg-surface p-8 text-center shadow-sm">
            <h2 className="mb-4 text-xl">Vault data unavailable</h2>
            <p className="mb-6 text-secondary">We could not load this vault right now. Please retry in a few minutes.</p>
            <Link href="/autovault">
              <Button variant="primary">Back to Autovaults</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col font-zen">
      <Header />
      <div className="mx-auto container flex-1 rounded pb-12">
        <div className="space-y-8">
          <div className="mt-6">
            <Breadcrumbs items={[{ label: 'Vault' }, { label: title, isCurrent: true }]} />
          </div>

          <VaultHeader
            vaultAddress={vaultAddressValue}
            chainId={chainId}
            title={title}
            symbol={symbolToDisplay ?? ''}
            assetAddress={assetAddress}
            assetSymbol={tokenSymbol}
            totalAssetsLabel={totalAssetsLabel}
            apyLabel={apyLabel}
            baseRateLabel={baseRateLabel}
            rateLabel={rateLabel}
            rewards={vaultRewardRows}
            showRewardSparkle={showFullRewardAPY && vaultRewardRows.length > 0}
            userShareBalance={userShareBalanceLabel}
            allocators={vaultData?.allocators}
            sentinels={vaultData?.sentinels}
            owner={vaultData?.owner}
            collaterals={collateralAddresses}
            curator={vaultData?.curator}
            adapter={adapterAddress}
            adapters={adapterQuery.adapters}
            capsAdapters={positionAdapters}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
            onRefresh={handleRefreshVault}
            onSettings={() => openSettings('general')}
            showWithdrawWhenEmpty
            isRefetching={isRefetching}
            isLoading={vaultDataLoading || vaultContract.isLoading}
            morphoHref={morphoVaultHref}
          />

          {needsInitialization && vaultContract.isOwner && networkConfig?.vaultConfig?.marketAdapterFactory && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Complete vault setup</p>
                <p className="text-sm text-secondary">
                  Run the setup multicall to link the adapter, set the registry, and lock required controls.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={openInitialization}
              >
                Start Setup
              </Button>
            </div>
          )}

          {isVaultInitialized && hasNoAllocators && vaultContract.isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Choose an allocator</p>
                <p className="text-sm text-secondary">Add an allocator to enable automated allocation and rebalancing.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={() => openSettings('roles')}
              >
                Configure allocator
              </Button>
            </div>
          )}

          {isVaultInitialized && capsUninitialized && vaultContract.isOwner && (
            <div className="rounded border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-primary">Configure allocation caps</p>
                <p className="text-sm text-secondary">
                  Set allocation limits for markets to complete your vault strategy and activate automation.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={() => openSettings('caps')}
              >
                Configure caps
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <VaultAnalyticsPeriodControl
              value={analyticsPeriod}
              onChange={handleAnalyticsPeriodChange}
            />

            <VaultSharePriceChart
              vaultAddress={vaultAddressValue}
              chainId={chainId}
              assetDecimals={tokenDecimals}
              assetSymbol={tokenSymbol}
              showPeriodControl={false}
            />

            <VaultAdaptersPositionDetail
              adapters={positionAdapters}
              assetAddress={assetAddress}
              chainId={chainId}
              vaultAddress={vaultAddressValue}
              isResolvingAdapter={vaultDataLoading || adapterQuery.isLoading || adapterQuery.isFetching || !vaultData}
              period={analyticsPeriod}
              totalAssets={vaultContract.totalAssets}
            />
          </div>

          <VaultSettingsModal
            vaultAddress={vaultAddressValue}
            chainId={chainId}
          />
        </div>
      </div>

      {networkConfig?.vaultConfig?.marketAdapterFactory && <VaultInitializationModal />}
    </div>
  );
}
