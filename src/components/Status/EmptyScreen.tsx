import Image from 'next/image';
import emptyImg from '../imgs/aragon/empty.png';

type EmptyScreenProps = {
  message?: string;
};

export default function EmptyScreen({ message = 'No data' }: EmptyScreenProps) {
  return (
    <div className="flex flex-col  items-center justify-center space-y-4 rounded-sm bg-secondary py-8 shadow-sm">
      <Image src={emptyImg} alt="Logo" width={200} height={200} className="py-4 pb-6" />
      <p className="pt-8 text-center text-secondary">{message}</p>
    </div>
  );
}
