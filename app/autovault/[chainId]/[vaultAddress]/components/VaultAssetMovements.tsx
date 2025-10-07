import { Button } from '@/components/common';

export type VaultAssetMovement = {
  timestamp: string;
  action: 'allocate' | 'deallocate';
  from?: string;
  to?: string;
  amount: string;
  hash?: string;
};

type VaultAssetMovementsProps = {
  history: VaultAssetMovement[];
};

export function VaultAssetMovements({ history }: VaultAssetMovementsProps) {
  return (
    <div className="bg-surface rounded p-4 shadow-sm font-zen">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Asset Movements</h3>
          <p className="text-xs text-secondary">Track how the allocator rebalanced capital.</p>
        </div>
        <Button variant="ghost" size="sm">
          Export CSV
        </Button>
      </div>
      {history.length === 0 ? (
        <div className="rounded bg-hovered py-12 text-center text-secondary">
          No rebalances recorded yet.
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto pr-1">
          <table className="responsive w-full font-zen text-sm">
            <thead className="table-header">
              <tr>
                <th className="font-normal">When</th>
                <th className="font-normal">Action</th>
                <th className="font-normal">Route</th>
                <th className="font-normal">Amount</th>
                <th className="font-normal">Tx</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {history.map((event, index) => (
                <tr key={`${event.timestamp}-${index}`}>
                  <td data-label="When">{event.timestamp}</td>
                  <td data-label="Action" className="capitalize">
                    {event.action}
                  </td>
                  <td data-label="Route">
                    {event.from && event.to ? `${event.from} → ${event.to}` : '—'}
                  </td>
                  <td data-label="Amount">{event.amount}</td>
                  <td data-label="Tx">
                    {event.hash ? (
                      <a
                        href={event.hash}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        View
                      </a>
                    ) : (
                      'Pending'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
