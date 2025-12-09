import { forwardRef } from 'react';
import { Link } from '@radix-ui/react-navigation-menu';
import { clsx } from 'clsx';

export const ListItem = forwardRef(function ListItemComponent(
  {
    children,
    target,
    href,
  }: {
    href: string;
    children: React.ReactNode;
    target?: string;
  },
  ref: React.Ref<HTMLAnchorElement>,
) {
  return (
    <div className="inline-flex items-center justify-start gap-8">
      <Link
        asChild
        className="flex items-center justify-start gap-1"
      >
        <a
          href={href}
          className={clsx('font-zen text-base font-normal text-white no-underline')}
          ref={ref}
          target={target}
        >
          {children}
        </a>
      </Link>
    </div>
  );
});
