'use client';

import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import NavbarMobile from './NavbarMobile';

function Menu() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <>
        <div className="h-[48px] w-full md:hidden" />
        <div className="container hidden h-[56px] md:block" />
      </>
    );
  }

  return (
    <>
      <div className="h-[48px] w-full md:hidden">
        <NavbarMobile />
      </div>
      <div className="container hidden h-[56px] md:block">
        <Navbar />
      </div>
    </>
  );
}

export default Menu;
