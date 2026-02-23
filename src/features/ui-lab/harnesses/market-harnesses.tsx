'use client';

import { useMemo, useState } from 'react';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';
import AssetFilter from '@/features/markets/components/filters/asset-filter';
import NetworkFilter from '@/features/markets/components/filters/network-filter';
import { MarketDetailsBlock } from '@/features/markets/components/market-details-block';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { MarketSelectionModal } from '@/features/markets/components/market-selection-modal';
import { MarketSelector } from '@/features/markets/components/market-selector';
import {
  createUiLabAssetFilterItems,
  createUiLabDefaultAssetSelection,
  createUiLabMarketVariantsFixture,
} from '@/features/ui-lab/fixtures/component-fixtures';
import { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const SUPPLY_PREVIEW_DELTA = 12_500_000n;
const BORROW_PREVIEW_DELTA = 8_000_000n;

export function NetworkFilterHarness(): JSX.Element {
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(SupportedNetworks.Mainnet);

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">Selected chain: {selectedNetwork ?? 'All networks'}</p>
      <div className="flex flex-wrap items-start gap-3">
        <NetworkFilter
          selectedNetwork={selectedNetwork}
          setSelectedNetwork={setSelectedNetwork}
          variant="compact"
          showLabelPrefix
        />
        <div className="w-[280px]">
          <NetworkFilter
            selectedNetwork={selectedNetwork}
            setSelectedNetwork={setSelectedNetwork}
          />
        </div>
      </div>
    </div>
  );
}

export function AssetFilterHarness(): JSX.Element {
  const items = useMemo(() => createUiLabAssetFilterItems(), []);
  const [selectedAssets, setSelectedAssets] = useState<string[]>(() => createUiLabDefaultAssetSelection(items));

  return (
    <div className="space-y-4">
      <AssetFilter
        label="Assets"
        placeholder="All assets"
        selectedAssets={selectedAssets}
        setSelectedAssets={setSelectedAssets}
        items={items}
        showLabelPrefix
      />
      <p className="text-sm text-secondary">Selected assets: {selectedAssets.length}</p>
    </div>
  );
}

export function MarketIdentityHarness(): JSX.Element {
  const markets = useMemo(() => createUiLabMarketVariantsFixture(), []);
  const market = markets[0];

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-secondary">Focused</p>
        <MarketIdentity
          market={market}
          chainId={market.morphoBlue.chain.id}
          mode={MarketIdentityMode.Focused}
          focus={MarketIdentityFocus.Loan}
          showId
        />
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-secondary">Minimum</p>
        <MarketIdentity
          market={market}
          chainId={market.morphoBlue.chain.id}
          mode={MarketIdentityMode.Minimum}
          focus={MarketIdentityFocus.Collateral}
          showLltv
          showOracle
        />
      </div>

      <div className="rounded-sm border border-border bg-surface p-4">
        <p className="mb-3 text-xs uppercase tracking-wide text-secondary">Badge</p>
        <MarketIdentity
          market={market}
          chainId={market.morphoBlue.chain.id}
          mode={MarketIdentityMode.Badge}
        />
      </div>
    </div>
  );
}

export function MarketDetailsBlockHarness(): JSX.Element {
  const market = useMemo(() => createUiLabMarketVariantsFixture()[0], []);
  const [mode, setMode] = useState<'supply' | 'borrow'>('supply');
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={mode === 'supply' ? 'surface' : 'ghost'}
          size="sm"
          onClick={() => setMode('supply')}
        >
          Supply Mode
        </Button>
        <Button
          variant={mode === 'borrow' ? 'surface' : 'ghost'}
          size="sm"
          onClick={() => setMode('borrow')}
        >
          Borrow Mode
        </Button>
        <Button
          variant={showPreview ? 'surface' : 'ghost'}
          size="sm"
          onClick={() => setShowPreview((prev) => !prev)}
        >
          {showPreview ? 'Preview Enabled' : 'Preview Disabled'}
        </Button>
      </div>

      <MarketDetailsBlock
        market={market}
        mode={mode}
        showDetailsLink
        defaultCollapsed={false}
        disableExpansion={false}
        supplyDelta={showPreview && mode === 'supply' ? SUPPLY_PREVIEW_DELTA : undefined}
        borrowDelta={showPreview && mode === 'borrow' ? BORROW_PREVIEW_DELTA : undefined}
      />
    </div>
  );
}

export function MarketSelectorHarness(): JSX.Element {
  const markets = useMemo(() => createUiLabMarketVariantsFixture(), []);
  const [addedMarketIds, setAddedMarketIds] = useState<string[]>([]);

  const handleAdd = (marketId: string) => {
    setAddedMarketIds((prev) => {
      if (prev.includes(marketId)) {
        return prev;
      }
      return [...prev, marketId];
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAddedMarketIds([])}
        >
          Reset Selection
        </Button>
        <p className="text-sm text-secondary">Added: {addedMarketIds.length}</p>
      </div>

      {markets.map((market) => {
        const isAdded = addedMarketIds.includes(market.uniqueKey);
        return (
          <MarketSelector
            key={market.uniqueKey}
            market={market}
            disabled={isAdded}
            onAdd={() => handleAdd(market.uniqueKey)}
          />
        );
      })}
    </div>
  );
}

export function MarketSelectionModalHarness(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isMultiSelect, setIsMultiSelect] = useState(true);
  const [selectedMarkets, setSelectedMarkets] = useState<Market[]>([]);
  const vaultAsset = useMemo<Address>(() => createUiLabMarketVariantsFixture()[0].loanAsset.address as Address, []);

  const selectedLabels = selectedMarkets.map((market) => `${market.loanAsset.symbol}/${market.collateralAsset.symbol}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsOpen(true)}
        >
          Open Market Selection Modal
        </Button>
        <Button
          variant={isMultiSelect ? 'surface' : 'ghost'}
          size="sm"
          onClick={() => setIsMultiSelect((prev) => !prev)}
        >
          {isMultiSelect ? 'Multi Select' : 'Single Select'}
        </Button>
      </div>

      <p className="text-sm text-secondary">Last selection: {selectedLabels.length > 0 ? selectedLabels.join(', ') : 'none'}</p>
      <p className="text-xs text-secondary/80">This one intentionally uses the live `MarketSelectionModal` data pipeline from the app.</p>

      {isOpen ? (
        <MarketSelectionModal
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          chainId={SupportedNetworks.Mainnet}
          vaultAsset={vaultAsset}
          multiSelect={isMultiSelect}
          onSelect={(markets) => setSelectedMarkets(markets)}
        />
      ) : null}
    </div>
  );
}
