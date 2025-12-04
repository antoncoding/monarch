'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuCopy, LuUser } from 'react-icons/lu';
import { SiEthereum } from 'react-icons/si';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getExplorerURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import type { Address } from 'viem';

type AccountActionsPopoverProps = {
  address: Address;
  children: ReactNode;
};

/**
 * Minimal popover showing account actions:
 * - Copy address
 * - View account (positions page)
 * - View on Etherscan
 */
export function AccountActionsPopover({
  address,
  children,
}: AccountActionsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toast = useStyledToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied', `${address.slice(0, 6)}...${address.slice(-4)}`);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to copy address', error);
    }
  }, [address, toast]);

  const handleViewAccount = useCallback(() => {
    window.location.href = `/positions/${address}`;
    setIsOpen(false);
  }, [address]);

  const handleViewExplorer = useCallback(() => {
    const explorerUrl = getExplorerURL(address, SupportedNetworks.Mainnet);
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  }, [address]);

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom"
      offset={8}
      classNames={{
        base: 'p-0',
        content: 'p-0 bg-surface shadow-lg border border-primary/10',
      }}
    >
      <PopoverTrigger>
        <div className="cursor-pointer">{children}</div>
      </PopoverTrigger>
      <PopoverContent>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex min-w-[180px] flex-col rounded-sm bg-surface font-zen"
            >
              {/* Copy Address */}
              <motion.button
                type="button"
                onClick={() => void handleCopy()}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <LuCopy className="h-4 w-4" />
                <span>Copy Address</span>
              </motion.button>

              {/* View Account */}
              <motion.button
                type="button"
                onClick={handleViewAccount}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <LuUser className="h-4 w-4" />
                <span>View Account</span>
              </motion.button>

              {/* View on Explorer */}
              <motion.button
                type="button"
                onClick={handleViewExplorer}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
              >
                <SiEthereum className="h-4 w-4" />
                <span>View on Explorer</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
