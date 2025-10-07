import { Tooltip } from '@heroui/react';
import { FiShield, FiUsers } from 'react-icons/fi';
import { TooltipContent } from '@/components/TooltipContent';

export type VaultRole = {
  key: 'owner' | 'curator' | 'allocator' | 'sentinel';
  label: string;
  description: string;
  addresses: string[];
  status: 'configured' | 'pending';
  guidance: string;
  capabilities: string[];
};

type VaultRolesOverviewProps = {
  roles: VaultRole[];
};

const ROLE_COLORS: Record<VaultRole['key'], string> = {
  owner: 'bg-purple-500',
  curator: 'bg-sky-500',
  allocator: 'bg-emerald-500',
  sentinel: 'bg-amber-500',
};

export function VaultRolesOverview({ roles }: VaultRolesOverviewProps) {
  return (
    <div className="bg-surface rounded p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Roles & Governance</h3>
          <p className="text-xs text-secondary">
            Assign independent keys so administration, risk, and execution stay separated.
          </p>
        </div>
        <Tooltip
          classNames={{
            base: 'p-0 m-0 bg-transparent shadow-sm border-none',
            content: 'p-0 m-0 bg-transparent shadow-sm border-none',
          }}
          content={
            <TooltipContent
              icon={<FiShield className="h-4 w-4" />}
              title="Role Separation"
              detail="Owner administers, Curator steers risk, Allocator executes, Sentinel reacts. Keep keys split."
            />
          }
        >
          <FiUsers className="h-5 w-5 text-secondary" />
        </Tooltip>
      </div>

      <div className="mt-4 space-y-4">
        {roles.map((role) => (
          <div key={role.key} className="rounded border border-divider/60 bg-hovered/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${ROLE_COLORS[role.key]}`} />
                <h4 className="text-sm font-semibold">{role.label}</h4>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  role.status === 'configured'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200'
                }`}
              >
                {role.status === 'configured' ? 'Configured' : 'Needs attention'}
              </span>
            </div>
            <p className="mt-2 text-sm text-secondary">{role.description}</p>

            <div className="mt-3 space-y-1">
              <span className="text-xs uppercase text-secondary">Assigned</span>
              {role.addresses.length === 0 ? (
                <div className="rounded bg-surface px-2 py-2 text-xs text-secondary">
                  No address assigned yet.
                </div>
              ) : (
                <ul className="space-y-1 text-xs">
                  {role.addresses.map((address) => (
                    <li key={address} className="rounded bg-surface px-2 py-1 font-monospace">
                      {address}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3">
              <span className="text-xs uppercase text-secondary">Capabilities</span>
              <ul className="mt-2 space-y-1 text-xs text-secondary">
                {role.capabilities.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>

            {role.status === 'pending' && (
              <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-300">
                {role.guidance}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
