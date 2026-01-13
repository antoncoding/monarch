'use client';

import { motion } from 'framer-motion';
import { MdError } from 'react-icons/md';
import { IoWarningOutline } from 'react-icons/io5';
import type { WarningWithDetail } from '@/utils/types';

type MarketWarningBannerProps = {
  warnings: WarningWithDetail[];
};

export function MarketWarningBanner({ warnings }: MarketWarningBannerProps) {
  if (warnings.length === 0) return null;

  const hasAlert = warnings.some((w) => w.level === 'alert');
  const Icon = hasAlert ? MdError : IoWarningOutline;

  const colorClasses = hasAlert ? 'border-red-500/20 bg-red-500/10 text-red-500' : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className={`mb-6 rounded-sm border p-3 text ${colorClasses}`}
    >
      <div className="flex items-start gap-3">
        <Icon
          size={18}
          className="mt-0.5 flex-shrink-0"
        />
        <div className="flex flex-col gap-1">
          {warnings.map((warning) => (
            <p key={warning.code}>{warning.description}</p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
