import { generateMetadata } from '@/utils/generateMetadata';
import AnalysisView from '@/features/analysis/analysis-view';

export const metadata = generateMetadata({
  title: 'Analysis | Monarch',
  description: 'Global Morpho market risk, oracle, peg, and asset exposure analysis',
  images: 'themes.png',
  pathname: '/analysis',
});

export default function AnalysisPage() {
  return <AnalysisView />;
}
