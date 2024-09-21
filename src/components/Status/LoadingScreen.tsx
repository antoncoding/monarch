import Image from 'next/image';
import { BarLoader } from 'react-spinners';

const loadingImg = require('../imgs/aragon/loading.png');

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center space-y-4 rounded-sm bg-secondary py-8 shadow-sm">
      <Image src={loadingImg} alt="Logo" width={200} height={200} className="py-4" />
      <BarLoader width={100} color="#f45f2d" height={2} className="pb-1" />
      <p className="pt-4 text-center text-secondary">{message}</p>
    </div>
  );
}
