'use client';

import { useRouter } from 'next/navigation';
import { useModal } from '@/hooks/useModal';
import { useAppSettings } from '@/stores/useAppSettings';
import { SettingActionItem, SettingToggleItem } from '../SettingItem';

export function DeveloperPanel() {
  const router = useRouter();
  const { close } = useModal();
  const { showDeveloperOptions, setShowDeveloperOptions } = useAppSettings();

  const handleOpenApiKeys = () => {
    close('monarchSettings');
    router.push('/api-keys');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">API Access</h3>
        <SettingActionItem
          title="API Keys"
          description="Create a Monarch API key for data access."
          buttonLabel="Create"
          onClick={handleOpenApiKeys}
        />
      </div>

      <div className="flex flex-col gap-4 rounded bg-surface p-4">
        <h3 className="text-xs uppercase text-secondary">Advanced Tools</h3>
        <SettingToggleItem
          title="Developer Options"
          description="Show advanced developer tools like Accrue Interest and Liquidate in market detail views."
          selected={showDeveloperOptions}
          onChange={setShowDeveloperOptions}
          ariaLabel="Toggle developer options"
        />
      </div>
    </div>
  );
}
