import type { ReactNode } from 'react';

type SwapTokenAmountFieldProps = {
  label: string;
  field: ReactNode;
  dropdown: ReactNode;
  footer?: ReactNode;
};

export function SwapTokenAmountField({ label, field, dropdown, footer }: SwapTokenAmountFieldProps) {
  return (
    <div className="rounded border border-white/10 bg-hovered px-3 py-2.5">
      <p className="mb-1 font-monospace text-[11px] uppercase tracking-[0.12em] text-secondary">{label}</p>
      <div className="relative">
        {field}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">{dropdown}</div>
      </div>
      {footer ? <div className="mt-1">{footer}</div> : null}
    </div>
  );
}
