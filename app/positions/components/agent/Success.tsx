import { Button } from '@nextui-org/react';
import { motion } from 'framer-motion';
import { FaCheckCircle } from 'react-icons/fa';

type SuccessProps = {
  onClose: () => void;
};

export function Success({ onClose }: SuccessProps) {
  
  
  return (
    <div className="flex flex-col items-center gap-8 text-center py-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-success"
      >
        <FaCheckCircle size={64} />
      </motion.div>

      <div className="space-y-4">
        <h3 className="text-2xl font-medium">
          Monarch Agent Successfully Setup!
        </h3>
        <p className="text-gray-400 max-w-lg mx-auto">
          Your Monarch Agent is now ready to help optimize your positions. 
          You can monitor your agent's activity and performance in the Positions dashboard.
        </p>
      </div>

      <div className="p-6 rounded-lg bg-content1 border border-divider w-full max-w-lg">
        <h4 className="text-lg font-medium mb-2">What's Next?</h4>
        <ul className="text-sm text-gray-400 text-left space-y-2">
          <li>• Monitor your agent's activity in the Positions dashboard</li>
          <li>• Review and adjust your market selection at any time</li>
          <li>• Track performance improvements across your positions</li>
        </ul>
      </div>

      <Button
        size="lg"
        variant="solid"
        color="primary"
        onPress={onClose}
        className="mt-4"
      >
        Done
      </Button>
    </div>
  );
}
