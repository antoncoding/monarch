import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/common';

const img = require('../../../../src/imgs/agent/agent.png') as string;

type SuccessProps = {
  onClose: () => void;
};

export function Success({ onClose }: SuccessProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-8 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="space-y-4">
          <h3 className="font-monospace font-medium">Beep boop... Command processed!</h3>

          <Image
            src={img}
            alt="Monarch Agent"
            width={180}
            height={180}
            className="mx-auto rounded-full"
          />

          <p className="mx-auto max-w-lg text-sm text-gray-400">
            Monarch Agent is now ready to help optimize your positions. You can monitor its activity
            and performance in the Portfolio dashboard.
          </p>
        </div>
      </motion.div>

      <Button onPress={onClose} variant="solid" className="mt-4">
        Done
      </Button>
    </div>
  );
}
