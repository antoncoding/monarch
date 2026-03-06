import { promises as fs } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import Header from '@/components/layout/header/Header';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { generateMetadata } from '@/utils/generateMetadata';

const POSTS_DIRECTORY = path.join(process.cwd(), 'src/content/posts');

type PostListItem = {
  slug: string;
  title: string;
  publishedDate: string | null;
  excerpt: string;
  sortTime: number;
};

const formatSlugTitle = (slug: string): string =>
  slug
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const parseDateFromSlug = (slug: string): { label: string | null; time: number } => {
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

const getPostPreview = (markdown: string, fallbackTitle: string): { title: string; excerpt: string } => {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  let title = fallbackTitle;
  let excerpt = 'Product update and announcement.';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const headingMatch = trimmed.match(/^#\s+(.+)$/);
    if (headingMatch && title === fallbackTitle) {
      title = headingMatch[1];
      continue;
    }

    if (
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('![') &&
      !trimmed.startsWith('```') &&
      !trimmed.startsWith('---') &&
      !trimmed.match(/^[-*]\s+/) &&
      !trimmed.match(/^\d+\.\s+/)
    ) {
      excerpt = trimmed.replace(/^>\s*/, '');
      break;
    }
  }

  return { title, excerpt };
};

const getAllPosts = async (): Promise<PostListItem[]> => {
  try {
    const entries = await fs.readdir(POSTS_DIRECTORY, { withFileTypes: true });
    const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));

    const posts = await Promise.all(
      markdownFiles.map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, '');
        const fallbackTitle = formatSlugTitle(slug);
        const filePath = path.join(POSTS_DIRECTORY, entry.name);
        const markdown = await fs.readFile(filePath, 'utf8');
        const { title, excerpt } = getPostPreview(markdown, fallbackTitle);
        const { label, time } = parseDateFromSlug(slug);

        return {
          slug,
          title,
          excerpt,
          publishedDate: label,
          sortTime: time,
        };
      }),
    );

    return posts.sort((first, second) => {
      if (first.sortTime !== second.sortTime) {
        return second.sortTime - first.sortTime;
      }

      return second.slug.localeCompare(first.slug);
    });
  } catch {
    return [];
  }
};

export const metadata = generateMetadata({
  title: 'Posts | Monarch',
  description: 'Monarch announcements and product updates',
  images: 'themes.png',
  pathname: '/posts',
});

export default async function PostsPage() {
  const posts = await getAllPosts();

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 pb-12">
        <div className="mt-10 min-h-10 flex items-center md:mt-12">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Posts', isCurrent: true },
            ]}
          />
        </div>

        <section className="mt-4 w-full pb-4">
          <header className="pb-2">
            <p className="text-xs uppercase tracking-[0.12em] text-secondary">Announcements</p>
            <h1 className="!pb-0 !pt-2 text-2xl font-normal sm:text-3xl">Posts</h1>
          </header>

          <div className="mt-3 flex flex-col gap-3">
            {posts.length === 0 ? (
              <p className="py-4 text-sm text-secondary">No posts published yet.</p>
            ) : (
              posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/posts/${post.slug}`}
                  className="no-underline rounded-lg px-4 py-4 transition-colors hover:bg-hovered"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded border border-primary/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary/80">
                      Product Update
                    </span>
                    {post.publishedDate && <span className="text-xs text-secondary">{post.publishedDate}</span>}
                  </div>
                  <h2 className="text-lg font-normal text-primary">{post.title}</h2>
                  <p className="mt-1 text-sm text-secondary">{post.excerpt}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
