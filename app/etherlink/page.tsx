import { redirect } from 'next/navigation';

export default function EtherlinkPage() {
  redirect('/markets?network=etherlink&ref=etherlink');
}
