import React from 'react';

type TxHashDisplayProps = {
  hash: string | undefined;
};

export function TxHashDisplay({ hash }: TxHashDisplayProps) {
  return (
    <div className="py-2 font-mono text-xs hover:underline">
      {hash ? `Tx Hash: ${hash.slice(0, 6)}...${hash.slice(-4)}` : ''}
    </div>
  );
}
