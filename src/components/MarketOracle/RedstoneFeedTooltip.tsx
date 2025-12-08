import Image from 'next/image';
import Link from 'next/link';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import type { RedstoneOracleEntry } from '@/constants/oracle/redstone-data';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';
import { RedstoneTypesModal } from './RedstoneTypesModal';

type RedstoneFeedTooltipProps = {
  feed: OracleFeed;
  redstoneData?: RedstoneOracleEntry;
  chainId: number;
};

export function RedstoneFeedTooltip({ feed, redstoneData, chainId }: RedstoneFeedTooltipProps) {
  const { toggleModal, closeModal } = useGlobalModal();
  const baseAsset = feed.pair?.[0] ?? redstoneData?.path.split('/')[0]?.toUpperCase() ?? 'Unknown';
  const quoteAsset = feed.pair?.[1] ?? redstoneData?.path.split('/')[1]?.toUpperCase() ?? 'Unknown';

  const vendorIcon = OracleVendorIcons[PriceFeedVendors.Redstone];

  return (
    <div className="bg-surface flex max-w-xs rounded-sm border border-gray-200/20 p-4 shadow-sm dark:border-gray-600/15">
      <div className="flex w-full flex-col gap-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          {vendorIcon && (
            <div className="flex-shrink-0">
              <Image src={vendorIcon} alt="Redstone" width={16} height={16} />
            </div>
          )}
          <div className="font-zen font-bold">Redstone Feed Details</div>
        </div>

        {/* Feed pair name */}
        <div className="flex items-center gap-2">
          <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
            {baseAsset} / {quoteAsset}
          </div>
        </div>

        {/* Redstone Specific Data */}
        {redstoneData && (
          <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
            <div className="flex items-center justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <div className="flex items-center gap-1">
                <span className="font-medium">{redstoneData.fundamental ? 'Fundamental' : 'Standard'}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleModal(<RedstoneTypesModal isOpen onClose={() => closeModal()} />);
                  }}
                  className="cursor-pointer text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
                  type="button"
                  aria-label="Learn about feed types"
                >
                  <IoHelpCircleOutline size={14} />
                </button>
              </div>
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
              <span className="font-medium">{redstoneData.heartbeat}s</span>
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
              <span className="font-medium">{redstoneData.threshold.toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* External Links */}
        <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="mb-2 font-zen text-sm font-medium text-gray-700 dark:text-gray-300">View on:</div>
          <div className="flex items-center gap-2">
            <Link
              href={getExplorerURL(feed.address as Address, chainId)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-hovered flex items-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-primary no-underline transition-all duration-200 hover:bg-opacity-80"
            >
              <Image src={etherscanLogo} alt="Etherscan" width={12} height={12} className="rounded-sm" />
              Etherscan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
