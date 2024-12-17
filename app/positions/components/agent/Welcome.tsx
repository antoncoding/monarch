import { Button } from '@nextui-org/react';
import { motion } from 'framer-motion';
import Image from 'next/image';

type WelcomeProps = {
  onNext: () => void;
};

export function Welcome({ onNext }: WelcomeProps) {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Image
          src="/images/monarch-agent-logo.png"
          alt="Monarch Agent"
          width={120}
          height={120}
          className="rounded-full"
        />
      </motion.div>

      <div className="space-y-4">
        <h3 className="text-2xl font-zen">
          Automate Your Position Management
        </h3>
        <p className="text-secondary max-w-lg mx-auto">
          Monarch Agent is a smart automation tool that helps you manage your positions across different markets. 
          It can automatically reallocate your assets to optimize your returns while maintaining your risk preferences.
        </p>
      </div>

      <Button
        size="lg"
        variant="solid"
        color="primary"
        onPress={onNext}
        className="mt-4"
      >
        Get Started
      </Button>
    </div>
  );
}