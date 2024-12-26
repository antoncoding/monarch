import Image from 'next/image';
import { BarLoader } from 'react-spinners';
import loadingImg from '../imgs/aragon/loading.png';

type LoadingScreenProps = {
  message?: string;
  className?: string;
};

export default function LoadingScreen({ message = 'Loading...', className }: LoadingScreenProps) {
  return (
    <div
      className={`bg-surface my-4 flex min-h-48 flex-col items-center justify-center space-y-4 rounded py-8 shadow-sm ${
        className ?? ''
      }`}
    >
      <Image src={loadingImg} alt="Logo" width={200} height={200} className="py-4" />
      <BarLoader width={100} color="#f45f2d" height={2} className="pb-1" />
      <p className="pt-4 text-center text-secondary">{message}</p>
    </div>
  );
}
