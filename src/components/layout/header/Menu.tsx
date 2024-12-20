import Navbar from './Navbar';
import NavbarMobile from './NavbarMobile';

function Menu() {
  return (
    <>
      <div className="h-[72px] md:hidden">
        <NavbarMobile />
      </div>
      <div className="container h-[72px] hidden md:block">
        <Navbar />
      </div>
    </>
  );
}

export default Menu;
