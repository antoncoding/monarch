import type { ReactNode } from 'react';

export function FilterSection({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="font-zen text-sm font-semibold text-primary">{title}</span>
        {helper && <span className="font-zen text-xs text-secondary">{helper}</span>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function FilterRow({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1 pr-4">
        <span className="font-zen text-sm font-medium text-primary">{title}</span>
        <div className="font-zen text-xs text-secondary">{description}</div>
      </div>
      <div className="pt-1">{children}</div>
    </div>
  );
}
