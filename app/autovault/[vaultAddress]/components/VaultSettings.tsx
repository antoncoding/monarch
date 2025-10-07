import { Button } from '@/components/common/Button';
import { AutovaultData } from '@/hooks/useAutovaultData';

type VaultSettingsProps = {
  vault: AutovaultData;
  onClose: () => void;
};

export function VaultSettings({ onClose, vault }: VaultSettingsProps) {
  const allocatorCount = vault.agents.length;

  return (
    <div className="space-y-6 font-zen">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Vault Controls</h3>
        <p className="text-sm text-secondary">Assign automation roles and manage the optimization agent.</p>
      </div>

      <div className="rounded border border-divider/60 bg-surface p-4">
        <h4 className="text-sm font-semibold">Optimization agent</h4>
        <p className="mt-2 text-sm text-secondary">
          Authorize the allocator address that executes deposits and withdrawals between enabled adapters.
        </p>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-secondary">
            {allocatorCount === 0
              ? 'No allocator assigned'
              : `${allocatorCount} allocator${allocatorCount > 1 ? 's' : ''} authorized`}
          </span>
          <Button variant="interactive" size="sm">
            {allocatorCount === 0 ? 'Add allocator' : 'Update allocator'}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="cta" onPress={onClose}>
          Close settings
        </Button>
      </div>
    </div>
  );
}
