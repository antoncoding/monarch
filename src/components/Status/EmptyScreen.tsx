import Image from 'next/image';
import emptyImg from '../imgs/aragon/empty.png';

type EmptyScreenProps = {
  message?: string;
  hint?: string;
};

export default function EmptyScreen({ message = 'No data', hint }: EmptyScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 rounded-sm bg-secondary py-8 shadow-sm">
      <Image src={emptyImg} alt="Logo" width={200} height={200} className="py-4 pb-6" />
      <p className="max-w-md text-center text-lg text-secondary">{message}</p>
      <p className="text-center text-sm text-gray-500">{hint}</p>
    </div>
  );
}
