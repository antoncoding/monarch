'use client';

import { Button } from '@/components/ui/button';
import { IconSwitch } from '@/components/ui/icon-switch';
import { useAppSettings } from '@/stores/useAppSettings';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import type { DetailView } from '../constants';

type TransactionPanelProps = {
  onNavigateToDetail?: (view: DetailView) => void;
};

export function TransactionPanel({ onNavigateToDetail }: TransactionPanelProps) {
  const { usePermit2, setUsePermit2 } = useAppSettings();
  const { hasAnyCustomRpcs } = useCustomRpcContext();
  const hasCustomRpcs = hasAnyCustomRpcs();

  return (
    <div className="flex flex-col gap-4">
      {/* Gasless Approvals */}
      <div className="flex items-center justify-between rounded bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-primary">Use Gasless Approvals</h3>
          <p className="text-xs text-secondary">
            Enable signature-based token approvals using Permit2. This bundles approvals and actions into a single transaction, saving gas.
          </p>
          <p className="mt-1.5 text-xs text-secondary">
            Note: If you're using a smart contract wallet (e.g. Safe), you should disable this to use native approval flow.
          </p>
        </div>
        <IconSwitch
          selected={usePermit2}
          onChange={setUsePermit2}
          size="xs"
          color="primary"
          aria-label="Toggle gasless approvals"
        />
      </div>

      {/* Custom RPC */}
      <div className="flex items-center justify-between rounded bg-surface p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-primary">Custom RPC Endpoints</h3>
            {hasCustomRpcs && (
              <span className="rounded-sm bg-green-500/20 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
                Configured
              </span>
            )}
          </div>
          <p className="text-xs text-secondary">Set custom RPC URLs to override the default Alchemy connections for each network.</p>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={() => onNavigateToDetail?.('rpc-config')}
        >
          {hasCustomRpcs ? 'Edit' : 'Configure'}
        </Button>
      </div>
    </div>
  );
}
