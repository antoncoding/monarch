import { motion } from 'framer-motion';
import { formatBalance } from '@/utils/balance';

type LTVWarningProps = {
  maxLTV: bigint;
  currentLTV: bigint;
  type: 'danger' | 'error';
};

export function LTVWarning({ maxLTV, currentLTV, type }: LTVWarningProps) {
  const isDanger = type === 'danger';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className={`mt-4 rounded-lg border p-3 text-sm ${
        isDanger
          ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
          : 'border-red-500/20 bg-red-500/10 text-red-500'
      }`}
    >
      <p>
        {isDanger ? (
          <>
            Warning: The resulting LTV ({formatBalance(currentLTV, 16).toPrecision(4)}%) is close to
            the maximum allowed LTV ({formatBalance(maxLTV, 16)}%). Consider adjusting your inputs
            to maintain a safer position.
          </>
        ) : (
          <>
            Please adjust your inputs. The resulting LTV (
            {formatBalance(currentLTV, 16).toPrecision(4)}
            %) would exceed the maximum allowed LTV ({formatBalance(maxLTV, 16)}%).
          </>
        )}
      </p>
    </motion.div>
  );
}
