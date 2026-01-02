'use client';

import { useState, useEffect } from 'react';
import Menu from './Menu';
import { NotificationBanner, useNotificationBannerVisible } from '../notification-banner';

export type HeaderProps = {
  ghost?: boolean;
};

type ScrollState = 'at-top' | 'scrolling-up' | 'scrolling-down';

function Header({ ghost }: HeaderProps) {
  const [scrollState, setScrollState] = useState<ScrollState>('at-top');
  const showBanner = useNotificationBannerVisible();

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

  // Spacer height: header (48/56px) + banner (48/56px if visible)
  const spacerClass = showBanner ? 'h-[96px] md:h-[112px]' : 'h-[48px] md:h-[56px]';

  return (
    <>
      {/* Spacer div for non-ghost headers to prevent content overlap */}
      {!ghost && <div className={`w-full ${spacerClass}`} />}
      <header
        data-scroll-state={scrollState}
        className="fixed left-0 right-0 top-0 w-full bg-surface"
        style={{ zIndex: 40 }}
      >
        {/* Bottom border aligned with content container */}
        <div className="w-full border-b border-dashed border-[var(--grid-cell-muted)]">
          <Menu />
        </div>
        {/* Notification banner below navbar */}
        <NotificationBanner />
      </header>
    </>
  );
}

export default Header;
