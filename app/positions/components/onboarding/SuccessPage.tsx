import { useEffect } from 'react';
import { Button } from '@nextui-org/react';
import { CheckCircledIcon } from '@radix-ui/react-icons';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';

export function SuccessPage() {
  const router = useRouter();

  const { address } = useAccount()

  // Automatically redirect to portfolio after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/positions/${address}`) // Corrected
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col items-center justify-center text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        <CheckCircledIcon className="h-20 w-20 text-green-500" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 font-zen text-3xl"
      >
        Position Created Successfully!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-2 text-gray-500"
      >
        Your supply position has been created. Redirecting to your portfolio...
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8"
      >
        <Button className='rounded' color="primary" onPress={() => router.push(`/positions/${address}`)}>
          View My Portfolio
        </Button>
      </motion.div>
    </motion.div>
  );
}
