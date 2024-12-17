import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '@/components/common';

const img = require('../../../../src/imgs/agent/agent-detailed.png');

type WelcomeProps = {
  onNext: () => void;
};

export function Welcome({ onNext }: WelcomeProps) {
  return (
    <div className="flex min-h-0 flex-col items-center gap-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Image src={img} alt="Monarch Agent" width={150} height={150} className="rounded-full" />
      </motion.div>

      <div className="space-y-4 text-center">
        <h3 className="font-zen text-2xl">Automate Your Position Management</h3>
        <p className="text-normal mx-auto max-w-lg font-zen text-secondary">
          Monarch Agent is a smart automation tool that helps you manage your positions across
          different markets. It can automatically reallocate your assets to optimize your returns
          while maintaining your risk preferences.
        </p>
      </div>

      <Button size="lg" variant="cta" onPress={onNext}>
        Get Started
      </Button>
    </div>
  );
}
