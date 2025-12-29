import Navbar from './Navbar';
import NavbarMobile from './NavbarMobile';

function Menu() {
  return (
    <>
      {/* Mobile: compact height */}
      <div className="h-[48px] w-full md:hidden">
        <NavbarMobile />
      </div>
      {/* Desktop: compact height, container width for content alignment */}
      <div className="container hidden h-[56px] md:block">
        <Navbar />
      </div>
    </>
  );
}

export default Menu;
