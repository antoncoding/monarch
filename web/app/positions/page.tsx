import { generateMetadata } from '@/utils/generateMetadata';
import PositionEntry from './PositionEntry';


export const metadata = generateMetadata({
  title: 'Positions',
  description: 'Permission-less access to morpho blue protocol',
  images: 'themes.png',
  pathname: '',
});

export default function LogIn() {
  return (<PositionEntry />)
}
