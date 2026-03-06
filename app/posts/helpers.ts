import path from 'node:path';

const deployUrl = process.env.BOAT_DEPLOY_URL ?? process.env.VERCEL_URL;

export const POSTS_DIRECTORY = path.join(process.cwd(), 'src/content/posts');
export const POSTS_SITE_ORIGIN = deployUrl ? `https://${deployUrl}` : 'https://monarchlend.xyz';

export type PostListItem = {
  slug: string;
  title: string;
  publishedDate: string | null;
  excerpt: string;
  sortTime: number;
};

export const formatSlugTitle = (slug: string): string =>
  slug
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const parseDateFromSlug = (slug: string): { label: string | null; time: number } => {
  const match = slug.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (!match) {
    return { label: null, time: 0 };
  }

  const [_, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { label: null, time: 0 };
  }

  return {
    label: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }),
    time: date.getTime(),
  };
};
