import { TxHashDisplay } from '../TxHashDisplay';

export function StyledToast({ title, message }: { title: string; message?: string }) {
  return (
    <div className="p-2">
      <div className="font-zen">{title}</div>
      {message && <div className="py-2 font-inter text-xs">{message}</div>}
    </div>
  );
}

export function TransactionToast({
  title,
  description,
  hash,
}: {
  title: string;
  hash?: string;
  description?: string;
}) {
  return (
    <div className="p-2 font-zen">
      <div className="text">{title}</div>
      {description && <div className="mb-2 mt-1 text-sm">{description}</div>}
      <TxHashDisplay hash={hash} />
    </div>
  );
}
