'use client';

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
      {/* Spacer div for non-ghost headers to prevent content overlap */}
      {!ghost && <div className="h-[48px] w-full md:h-[56px]" />}
      <header
        data-scroll-state={scrollState}
        className="fixed left-0 right-0 top-0 w-full bg-surface"
        style={{ zIndex: 40 }}
      >
        {/* Bottom border aligned with content container */}
        <div className="w-full border-b border-dashed border-[var(--grid-cell-muted)]">
          <Menu />
        </div>
      </header>
    </>
  );
}

export default Header;
