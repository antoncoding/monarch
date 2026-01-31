import Image from 'next/image';
import Link from 'next/link';
import { HiOutlineClock } from 'react-icons/hi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import type { IndexingVault } from '@/hooks/queries/useUserVaultsV2Query';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { getSlicedAddress } from '@/utils/address';

type IndexingVaultsCardProps = {
  indexingVaults: IndexingVault[];
};

export function IndexingVaultsCard({ indexingVaults }: IndexingVaultsCardProps) {
  return (
    <div className="space-y-4 overflow-x-auto">
      <TableContainerWithHeader title="Auto Vaults (Indexing)">
        <Table className="responsive w-full min-w-[640px]">
          <TableHeader>
            <TableRow className="w-full justify-center text-secondary">
              <TableHead className="w-10">Network</TableHead>
              <TableHead>Vault</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {indexingVaults.map((vault) => {
              const networkLogo = getNetworkImg(vault.networkId);
              const networkName = getNetworkName(vault.networkId);
              return (
                <TableRow key={`${vault.address}-${vault.networkId}`}>
                  <TableCell className="w-10">
                    <div className="flex items-center justify-center">
                      {networkLogo && (
                        <Image
                          src={networkLogo}
                          alt={networkName ?? 'Network'}
                          width={24}
                          height={24}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-label="Vault">
                    <div className="flex items-center justify-center">
                      <Link
                        href={`/autovault/${vault.networkId}/${vault.address}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {getSlicedAddress(vault.address as `0x${string}`)}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell data-label="Status">
                    <div className="flex items-center justify-center gap-2">
                      <HiOutlineClock className="w-4 h-4 text-secondary" />
                      <span className="text-secondary">Indexing...</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="px-6 py-1 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-secondary">
            {indexingVaults.length === 1 ? 'Your vault is' : 'Your vaults are'} still being indexed and will appear
            in the main table within 30 minutes. Your funds are safe.
          </p>
        </div>
      </TableContainerWithHeader>
    </div>
  );
}
