import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/common';

const img = require('../../../../src/imgs/agent/agent.png') as string;

type SuccessProps = {
  onClose: () => void;
  onDone: () => void;
};

export function Success({ onClose, onDone }: SuccessProps) {
  const handleDone = () => {
    onDone();
    onClose();
  };

  return (
    <div className="flex flex-col items-center gap-8 py-8 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Image src={img} alt="Success" width={150} height={150} className="rounded-full" />
      </motion.div>

      <div className="space-y-4">
        <h3 className="font-zen text-2xl">Setup Complete!</h3>
        <p className="mx-auto max-w-lg font-zen text-secondary">
          Your Monarch Agent is now ready to manage your positions. You can always update your
          settings later.
        </p>
      </div>

      <Button size="lg" variant="cta" onPress={handleDone}>
        Done
      </Button>
    </div>
  );
}
