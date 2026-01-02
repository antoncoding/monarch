'use client';

import { TrashIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import type { SupportedNetworks } from '@/utils/networks';
import type { PriceFeedVendors } from '@/utils/oracle';
import type { ERC20Token, UnknownERC20Token } from '@/utils/tokens';

import { ExpandableSearchInput } from './expandable-search-input';
import NetworkFilter from './network-filter';
import AssetFilter from './asset-filter';
import OracleFilter from './oracle-filter';

type CompactFilterBarProps = {
  // Search
  searchQuery: string;
  onSearch: (query: string) => void;
  searchInputId?: string;

  // Network
  selectedNetwork: SupportedNetworks | null;
  setSelectedNetwork: (network: SupportedNetworks | null) => void;

  // Loan assets
  selectedLoanAssets: string[];
  setSelectedLoanAssets: (assets: string[]) => void;
  loanAssetItems: (ERC20Token | UnknownERC20Token)[];

  // Collaterals
  selectedCollaterals: string[];
  setSelectedCollaterals: (assets: string[]) => void;
  collateralItems: (ERC20Token | UnknownERC20Token)[];

  // Oracles
  selectedOracles: PriceFeedVendors[];
  setSelectedOracles: (oracles: PriceFeedVendors[]) => void;

  // Loading
  loading: boolean;

  // Clear all filters
  onClearAll?: () => void;
};

export function CompactFilterBar({
  searchQuery,
  onSearch,
  searchInputId = 'market-search-input',
  selectedNetwork,
  setSelectedNetwork,
  selectedLoanAssets,
  setSelectedLoanAssets,
  loanAssetItems,
  selectedCollaterals,
  setSelectedCollaterals,
  collateralItems,
  selectedOracles,
  setSelectedOracles,
  loading,
  onClearAll,
}: CompactFilterBarProps) {
  const hasActiveFilters =
    selectedNetwork !== null || selectedLoanAssets.length > 0 || selectedCollaterals.length > 0 || selectedOracles.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
      <ExpandableSearchInput
        value={searchQuery}
        onChange={onSearch}
        placeholder="Search markets..."
        id={searchInputId}
      />

      <NetworkFilter
        variant="compact"
        showLabelPrefix
        selectedNetwork={selectedNetwork}
        setSelectedNetwork={setSelectedNetwork}
      />

      <AssetFilter
        showLabelPrefix
        label="Loan"
        placeholder="All"
        selectedAssets={selectedLoanAssets}
        setSelectedAssets={setSelectedLoanAssets}
        items={loanAssetItems}
        loading={loading}
      />

      <AssetFilter
        showLabelPrefix
        label="Collateral"
        placeholder="All"
        selectedAssets={selectedCollaterals}
        setSelectedAssets={setSelectedCollaterals}
        items={collateralItems}
        loading={loading}
      />

      <OracleFilter
        showLabelPrefix
        selectedOracles={selectedOracles}
        setSelectedOracles={setSelectedOracles}
      />

      {hasActiveFilters && onClearAll && (
        <Button
          variant="default"
          size="md"
          onClick={onClearAll}
          className="w-10 min-w-10 px-0"
          aria-label="Clear all filters"
        >
          <TrashIcon />
        </Button>
      )}
    </div>
  );
}
