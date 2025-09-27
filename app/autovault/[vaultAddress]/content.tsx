'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader, CardBody } from '@heroui/react';
import { ChevronLeftIcon, GearIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import Header from '@/components/layout/header/Header';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { useVaultDetails } from '@/hooks/useAutovaultData';
import { formatReadable } from '@/utils/balance';
import { VaultSettings } from './components/VaultSettings';

export default function VaultContent() {
  const router = useRouter();
  const { vaultAddress } = useParams<{ vaultAddress: string }>();
  const { address } = useAccount();
  const [showSettings, setShowSettings] = useState(false);

  const { vault, isLoading, isError } = useVaultDetails(vaultAddress as Address);

  const isOwner = useMemo(() => {
    if (!vault || !address) return false;
    return vault.owner.toLowerCase() === address.toLowerCase();
  }, [vault, address]);

  if (isLoading) {
    return (
      <div className="flex w-full flex-col justify-between font-zen">
        <Header />
        <LoadingScreen message="Loading Vault Details..." />
      </div>
    );
  }

  if (isError || !vault) {
    return (
      <div className="flex w-full flex-col justify-between font-zen">
        <Header />
        <div className="container h-full gap-8 px-[5%]">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <h2 className="mb-4 text-xl font-semibold">Vault Not Found</h2>
              <p className="mb-6 text-secondary">
                The requested vault could not be found or does not exist.
              </p>
              <Link href="/autovault">
                <Button variant="cta">Back to Autovaults</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[5%]">
        {/* Header Section */}
        <div className="flex items-center gap-4 pb-4">
          <Button
            variant="light"
            size="sm"
            onPress={() => router.back()}
            className="flex items-center gap-2"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="font-zen text-2xl">{vault.name}</h1>
            <p className="text-sm text-secondary">{vault.description}</p>
          </div>
          {isOwner && (
            <Button
              variant="light"
              size="sm"
              onPress={() => setShowSettings(true)}
              className="flex items-center gap-2"
            >
              <GearIcon className="h-4 w-4" />
              Settings
            </Button>
          )}
        </div>

        {/* Vault Address */}
        <div className="pb-4">
          <AddressDisplay address={vaultAddress as Address} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Basic Info Card */}
          <Card className="bg-surface">
            <CardHeader>
              <h3 className="text-lg font-semibold">Vault Overview</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-secondary">Status</span>
                  <span
                    className={`font-semibold ${
                      vault.status === 'active'
                        ? 'text-green-500'
                        : vault.status === 'paused'
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    }`}
                  >
                    {vault.status.charAt(0).toUpperCase() + vault.status.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Total Value</span>
                  <span className="font-semibold">${formatReadable(vault.totalValue)} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Current APY</span>
                  <span className="font-semibold text-green-500">
                    {vault.currentApy.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Active Agents</span>
                  <span className="font-semibold">
                    {vault.agents.filter((agent) => agent.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Created</span>
                  <span className="text-secondary">{vault.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Performance Card */}
          <Card className="bg-surface">
            <CardHeader>
              <h3 className="text-lg font-semibold">Performance</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">
                    {vault.currentApy.toFixed(2)}%
                  </p>
                  <p className="text-sm text-secondary">Current APY</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="text-center">
                    <p className="text-lg font-semibold">${formatReadable(vault.totalValue)}</p>
                    <p className="text-xs text-secondary">Total Value Locked</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{vault.rebalanceHistory.length}</p>
                    <p className="text-xs text-secondary">Total Rebalances</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Agents Card */}
          <Card className="bg-surface">
            <CardHeader>
              <h3 className="text-lg font-semibold">Active Agents</h3>
            </CardHeader>
            <CardBody>
              {vault.agents.length === 0 ? (
                <p className="py-4 text-center text-secondary">No agents configured</p>
              ) : (
                <div className="space-y-3">
                  {vault.agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between rounded-lg border border-divider p-3"
                    >
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-secondary">{agent.description}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          agent.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : agent.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Recent Rebalances Card */}
          <Card className="bg-surface">
            <CardHeader>
              <h3 className="text-lg font-semibold">Recent Rebalances</h3>
            </CardHeader>
            <CardBody>
              {vault.rebalanceHistory.length === 0 ? (
                <p className="py-4 text-center text-secondary">No rebalances yet</p>
              ) : (
                <div className="space-y-3">
                  {vault.rebalanceHistory.slice(0, 5).map((rebalance, index) => (
                    <div key={index} className="border-b border-divider pb-3 last:border-b-0">
                      <div className="flex justify-between text-sm">
                        <span className="text-secondary">
                          {rebalance.fromMarket} → {rebalance.toMarket}
                        </span>
                        <span className="font-medium">${formatReadable(rebalance.amount)}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-xs">
                        <span className="text-secondary">{rebalance.reason}</span>
                        <span className="text-secondary">
                          {rebalance.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-8">
            <Card className="bg-surface">
              <CardBody>
                <VaultSettings vault={vault} onClose={() => setShowSettings(false)} />
              </CardBody>
            </Card>
          </div>
        )}

        {/* TODO: Add charts and more detailed analytics */}
        {!showSettings && (
          <div className="mt-8">
            <Card className="bg-surface">
              <CardHeader>
                <h3 className="text-lg font-semibold">Analytics & Charts</h3>
              </CardHeader>
              <CardBody>
                <div className="py-8 text-center text-secondary">
                  <p>Performance charts and analytics coming soon...</p>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
