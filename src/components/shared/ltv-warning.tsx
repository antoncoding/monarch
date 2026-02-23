import { motion } from 'framer-motion';

const LTV_PERCENT_SCALE = 1e16;
const INFINITE_LTV_THRESHOLD = 10n ** 30n;
const formatLtvPercent = (ltv: bigint): string => {
  if (ltv >= INFINITE_LTV_THRESHOLD) return '∞';
  return (Number(ltv) / LTV_PERCENT_SCALE).toFixed(2);
};

type LTVWarningProps = {
  maxLTV: bigint;
  currentLTV: bigint;
  type: 'danger' | 'error';
  customMessage?: string;
};

export function LTVWarning({ maxLTV, currentLTV, type, customMessage }: LTVWarningProps) {
  const isDanger = type === 'danger';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className={`mt-4 rounded-lg border p-3 text-sm ${
        isDanger ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500' : 'border-red-500/20 bg-red-500/10 text-red-500'
      }`}
    >
      <p>
        {customMessage ? (
          customMessage
        ) : isDanger ? (
          <>
            Warning: The resulting LTV ({formatLtvPercent(currentLTV)}%) is close to the maximum allowed LTV (
            {formatLtvPercent(maxLTV)}%). Consider adjusting your inputs to maintain a safer position.
          </>
        ) : (
          <>
            Please adjust your inputs. The resulting LTV ({formatLtvPercent(currentLTV)}
            %) would exceed the maximum allowed LTV ({formatLtvPercent(maxLTV)}
            %).
          </>
        )}
      </p>
    </motion.div>
  );
}
