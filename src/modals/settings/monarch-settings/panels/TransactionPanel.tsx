'use client';

import { useAppSettings } from '@/stores/useAppSettings';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { SettingToggleItem, SettingActionItem } from '../SettingItem';
import type { DetailView } from '../constants';

type TransactionPanelProps = {
  onNavigateToDetail?: (view: Exclude<DetailView, null>) => void;
};

export function TransactionPanel({ onNavigateToDetail }: TransactionPanelProps) {
  const { usePermit2, setUsePermit2 } = useAppSettings();
  const { hasAnyCustomRpcs } = useCustomRpcContext();
  const hasCustomRpcs = hasAnyCustomRpcs();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded bg-surface p-4">
        <SettingToggleItem
          title="Use Gasless Approvals"
          description={
            <>
              <p>
                Enable signature-based token approvals using Permit2. This bundles approvals and actions into a single transaction, saving
                gas.
              </p>
              <p className="mt-1.5">
                Note: If you're using a smart contract wallet (e.g. Safe), you should disable this to use native approval flow.
              </p>
            </>
          }
          selected={usePermit2}
          onChange={setUsePermit2}
          ariaLabel="Toggle gasless approvals"
        />
      </div>

      <div className="rounded bg-surface p-4">
        <SettingActionItem
          title="Custom RPC Endpoints"
          description="Set custom RPC URLs to override the default Alchemy connections for each network."
          buttonLabel={hasCustomRpcs ? 'Edit' : 'Configure'}
          onClick={() => onNavigateToDetail?.('rpc-config')}
          badge={
            hasCustomRpcs ? (
              <span className="rounded-sm bg-green-500/20 px-1.5 py-0.5 text-[9px] font-medium text-green-600 dark:text-green-400">
                Configured
              </span>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
