import Link from 'next/link';

type PrimaryButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  isSecondary?: boolean;
};

export default function PrimaryButton({
  href,
  children,
  className = '',
  isSecondary,
}: PrimaryButtonProps) {
  return (
    <Link href={href}>
      <button
        type="button"
        className={`${
          isSecondary ? 'bg-surface' : 'bg-monarch-orange'
        } rounded-sm p-4 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100 ${className} hover:scale-105`}
      >
        {children}
      </button>
    </Link>
  );
}
