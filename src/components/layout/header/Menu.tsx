import Navbar from './Navbar';
import NavbarMobile from './NavbarMobile';

function Menu() {
  return (
    <>
      <div className="h-[56px] w-full md:hidden">
        <NavbarMobile />
      </div>
      <div className="container hidden h-[72px] md:block">
        <Navbar />
      </div>
    </>
  );
}

export default Menu;
