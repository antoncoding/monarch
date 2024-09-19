import Link from 'next/link';

interface PrimaryButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function PrimaryButton({ href, children, className = '' }: PrimaryButtonProps) {
  return (
    <Link href={href}>
      <button
        type="button"
        className={`bg-monarch-orange rounded-sm p-4 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100 ${className}`}
      >
        {children}
      </button>
    </Link>
  );
}