import { useState, useEffect } from 'react';
import Menu from './Menu';

export type HeaderProps = {
  ghost?: boolean;
};

type ScrollState = 'at-top' | 'scrolling-up' | 'scrolling-down';

function Header({ ghost }: HeaderProps) {
  const [scrollState, setScrollState] = useState<ScrollState>('at-top');

  useEffect(() => {
    let previousScrollY = window.scrollY;

    const handleScroll = () => {
      const direction = previousScrollY < window.scrollY ? 'scrolling-down' : 'scrolling-up';
      const state = window.scrollY < 30 ? 'at-top' : direction;
      previousScrollY = window.scrollY;
      setScrollState(state);
    };

    if (ghost) {
      addEventListener('scroll', handleScroll, { passive: true });
    } else {
      removeEventListener('scroll', handleScroll);
    }

    handleScroll();
    return () => removeEventListener('scroll', handleScroll);
  }, [ghost]);

  return (
    <>
      <div className="h-[80px] w-full md:h-[120px]" /> {/* Spacer div */}
      <header
        data-scroll-state={scrollState}
        className="bg-main fixed left-0 right-0 top-0 flex h-[60px] justify-center md:h-[120px] md:pt-4"
        style={{ zIndex: 40 }} // Lower z-index to work with modal backdrop
      >
        <Menu />
      </header>
    </>
  );
}

export default Header;
