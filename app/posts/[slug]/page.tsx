import { promises as fs } from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Header from '@/components/layout/header/Header';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { generateMetadata as buildMetadata } from '@/utils/generateMetadata';
import { POSTS_DIRECTORY, POSTS_SITE_ORIGIN, formatSlugTitle, parseDateFromSlug } from '../helpers';
const VALID_SLUG_PATTERN = /^[a-z0-9-]+$/;
const FALLBACK_IMAGE_WIDTH = 1600;
const FALLBACK_IMAGE_HEIGHT = 900;

type PostPageProps = {
  params: Promise<{ slug: string }>;
};

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'image'; alt: string; src: string; title?: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'hr' };

const isExternalUrl = (value: string): boolean => value.startsWith('https://') || value.startsWith('http://');

const resolveImageSource = (source: string, slug: string): string => {
  if (source.startsWith('/')) {
    return source;
  }

  if (isExternalUrl(source)) {
    return source;
  }

  const sanitized = source.replace(/^\.?\//, '');
  return `/posts/${slug}/${sanitized}`;
};

const getPostMarkdown = async (slug: string): Promise<string | null> => {
  if (!VALID_SLUG_PATTERN.test(slug)) {
    return null;
  }

  const filePath = path.join(POSTS_DIRECTORY, `${slug}.md`);

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error: unknown) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const parseMarkdownBlocks = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' '),
    });
    paragraphLines = [];
  };

  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index] ?? '';
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (trimmedLine.startsWith('```')) {
      flushParagraph();

      const language = trimmedLine.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[index] ?? '');
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: 'code',
        language,
        content: codeLines.join('\n'),
      });
      continue;
    }

    if (trimmedLine === '---') {
      flushParagraph();
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    const imageMatch = trimmedLine.match(/^!\[(.*?)\]\((.+?)(?:\s+"(.*?)")?\)$/);
    if (imageMatch) {
      flushParagraph();
      blocks.push({
        type: 'image',
        alt: imageMatch[1],
        src: imageMatch[2],
        title: imageMatch[3],
      });
      index += 1;
      continue;
    }

    const quoteMatch = trimmedLine.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      const quoteLines: string[] = [quoteMatch[1]];
      index += 1;

      while (index < lines.length) {
        const nextLine = (lines[index] ?? '').trim();
        const nextQuoteMatch = nextLine.match(/^>\s+(.+)$/);
        if (!nextQuoteMatch) {
          break;
        }

        quoteLines.push(nextQuoteMatch[1]);
        index += 1;
      }

      blocks.push({
        type: 'blockquote',
        text: quoteLines.join(' '),
      });
      continue;
    }

    const unorderedListMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    if (unorderedListMatch) {
      flushParagraph();
      const items: string[] = [unorderedListMatch[1]];
      index += 1;

      while (index < lines.length) {
        const nextItem = (lines[index] ?? '').trim().match(/^[-*]\s+(.+)$/);
        if (!nextItem) {
          break;
        }

        items.push(nextItem[1]);
        index += 1;
      }

      blocks.push({
        type: 'unordered-list',
        items,
      });
      continue;
    }

    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      flushParagraph();
      const items: string[] = [orderedListMatch[1]];
      index += 1;

      while (index < lines.length) {
        const nextItem = (lines[index] ?? '').trim().match(/^\d+\.\s+(.+)$/);
        if (!nextItem) {
          break;
        }

        items.push(nextItem[1]);
        index += 1;
      }

      blocks.push({
        type: 'ordered-list',
        items,
      });
      continue;
    }

    paragraphLines.push(trimmedLine);
    index += 1;
  }

  flushParagraph();
  return blocks;
};

const parseInlineMarkdown = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  const patterns = [
    { type: 'link', regex: /\[([^\]]+)\]\(([^)]+)\)/ },
    { type: 'bold', regex: /\*\*([^*]+)\*\*/ },
    { type: 'code', regex: /`([^`]+)`/ },
  ] as const;

  while (remaining.length > 0) {
    const candidates = patterns
      .map((pattern) => {
        const match = remaining.match(pattern.regex);
        if (!match || match.index === undefined) {
          return null;
        }

        return {
          type: pattern.type,
          index: match.index,
          match,
        };
      })
      .filter((candidate) => candidate !== null);

    if (candidates.length === 0) {
      nodes.push(remaining);
      break;
    }

    candidates.sort((first, second) => first.index - second.index);
    const nextToken = candidates[0];

    if (nextToken.index > 0) {
      nodes.push(remaining.slice(0, nextToken.index));
    }

    const tokenText = nextToken.match[0];

    if (nextToken.type === 'link') {
      const [, label, href] = nextToken.match;
      const linkKey = `${keyPrefix}-link-${keyIndex}`;
      const linkClassName = 'underline underline-offset-2 transition-colors hover:text-primary';

      nodes.push(
        isExternalUrl(href) ? (
          <a
            key={linkKey}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={linkClassName}
          >
            {label}
          </a>
        ) : (
          <Link
            key={linkKey}
            href={href}
            className={linkClassName}
          >
            {label}
          </Link>
        ),
      );
    }

    if (nextToken.type === 'bold') {
      nodes.push(
        <strong
          key={`${keyPrefix}-bold-${keyIndex}`}
          className="font-normal"
        >
          {nextToken.match[1]}
        </strong>,
      );
    }

    if (nextToken.type === 'code') {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${keyIndex}`}
          className="rounded bg-hovered px-1.5 py-0.5 text-[0.85em] font-monospace"
        >
          {nextToken.match[1]}
        </code>,
      );
    }

    remaining = remaining.slice(nextToken.index + tokenText.length);
    keyIndex += 1;
  }

  return nodes;
};

const getPostTitleFromBlocks = (blocks: MarkdownBlock[], slug: string): string => {
  const firstHeading = blocks.find((block) => block.type === 'heading' && block.level === 1);
  if (firstHeading && firstHeading.type === 'heading') {
    return firstHeading.text;
  }

  return formatSlugTitle(slug);
};

const renderMarkdownBlock = (block: MarkdownBlock, slug: string, index: number): ReactNode => {
  const blockKey = `${slug}-block-${index}`;

  if (block.type === 'heading') {
    if (block.level === 1) {
      return (
        <h2
          key={blockKey}
          className="font-zen pt-2 text-2xl leading-tight font-normal text-primary sm:text-3xl"
        >
          {parseInlineMarkdown(block.text, `${blockKey}-h1`)}
        </h2>
      );
    }

    if (block.level === 2) {
      return (
        <h3
          key={blockKey}
          className="font-zen pt-2 text-xl leading-tight font-normal text-primary sm:text-2xl"
        >
          {parseInlineMarkdown(block.text, `${blockKey}-h2`)}
        </h3>
      );
    }

    return (
      <h4
        key={blockKey}
        className="font-zen pt-2 text-lg leading-tight font-normal text-primary"
      >
        {parseInlineMarkdown(block.text, `${blockKey}-h3`)}
      </h4>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <p
        key={blockKey}
        className="text-base leading-6 text-primary"
      >
        {parseInlineMarkdown(block.text, `${blockKey}-paragraph`)}
      </p>
    );
  }

  if (block.type === 'unordered-list') {
    return (
      <ul
        key={blockKey}
        className="space-y-2 text-base leading-6 text-primary"
      >
        {block.items.map((item, itemIndex) => (
          <li
            key={`${blockKey}-ul-item-${itemIndex}`}
            className="flex items-start gap-2"
          >
            <span className="text-secondary">-</span>
            <span>{parseInlineMarkdown(item, `${blockKey}-ul-inline-${itemIndex}`)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'ordered-list') {
    return (
      <ol
        key={blockKey}
        className="space-y-2 text-base leading-6 text-primary"
      >
        {block.items.map((item, itemIndex) => (
          <li
            key={`${blockKey}-ol-item-${itemIndex}`}
            className="flex items-start gap-3"
          >
            <span className="w-5 text-secondary">{itemIndex + 1}.</span>
            <span>{parseInlineMarkdown(item, `${blockKey}-ol-inline-${itemIndex}`)}</span>
          </li>
        ))}
      </ol>
    );
  }

  if (block.type === 'blockquote') {
    return (
      <blockquote
        key={blockKey}
        className="border-l-2 border-[var(--grid-cell-active)] pl-4 text-secondary italic"
      >
        {parseInlineMarkdown(block.text, `${blockKey}-quote`)}
      </blockquote>
    );
  }

  if (block.type === 'code') {
    return (
      <pre
        key={blockKey}
        className="custom-scrollbar overflow-x-auto rounded-md border border-[var(--grid-cell-muted)] bg-hovered p-4 text-sm font-monospace leading-6 text-primary"
      >
        <code className="font-monospace">{block.content}</code>
      </pre>
    );
  }

  if (block.type === 'hr') {
    return (
      <div
        key={blockKey}
        className="h-2"
      />
    );
  }

  const source = resolveImageSource(block.src, slug);
  const imageClassName = 'h-auto w-full rounded-md bg-hovered object-contain max-h-[520px]';

  if (isExternalUrl(source)) {
    return (
      <p
        key={blockKey}
        className="text-sm text-secondary"
      >
        External image URLs are not enabled in posts yet. Open:{' '}
        <a
          href={source}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {source}
        </a>
      </p>
    );
  }

  return (
    <figure
      key={blockKey}
      className="space-y-2"
    >
      <Image
        src={source}
        alt={block.alt || 'Post image'}
        width={FALLBACK_IMAGE_WIDTH}
        height={FALLBACK_IMAGE_HEIGHT}
        className={imageClassName}
      />
      {block.title && <figcaption className="text-sm text-secondary">{block.title}</figcaption>}
    </figure>
  );
};

const getPostStructure = (markdown: string, slug: string) => {
  const blocks = parseMarkdownBlocks(markdown);
  const title = getPostTitleFromBlocks(blocks, slug);
  const hasLeadHeading = blocks[0]?.type === 'heading' && blocks[0].level === 1;
  const contentBlocks = hasLeadHeading ? blocks.slice(1) : blocks;

  return { title, contentBlocks };
};

export async function generateStaticParams() {
  try {
    const entries = await fs.readdir(POSTS_DIRECTORY, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => ({
        slug: entry.name.replace(/\.md$/, ''),
      }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const markdown = await getPostMarkdown(slug);
  const title = markdown ? getPostStructure(markdown, slug).title : formatSlugTitle(slug);
  const resolvedTitle = `${title} | Monarch`;

  const baseMetadata = buildMetadata({
    title: resolvedTitle,
    description: 'Monarch product update',
    images: 'themes.png',
    url: POSTS_SITE_ORIGIN,
    pathname: `/posts/${slug}`,
  });

  return {
    ...baseMetadata,
    openGraph: {
      ...baseMetadata.openGraph,
      title: resolvedTitle,
      description: 'Monarch product update',
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: 'Monarch product update',
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const markdown = await getPostMarkdown(slug);

  if (!markdown) {
    notFound();
  }

  const { title, contentBlocks } = getPostStructure(markdown, slug);
  const { label: publishedDate } = parseDateFromSlug(slug);

  return (
    <div className="bg-main min-h-screen font-zen">
      <Header />
      <main className="container h-full pb-12">
        <div className="mt-10 min-h-10 flex items-center md:mt-12">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Posts', href: '/posts' },
              { label: title, isCurrent: true },
            ]}
          />
        </div>

        <article className="mt-5 mx-auto flex w-full max-w-4xl flex-col gap-5 pb-8">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded border border-primary/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary/80">
                Product Update
              </span>
              {publishedDate && <p className="text-xs text-secondary">{publishedDate}</p>}
            </div>
            <h1 className="!p-0 text-3xl leading-tight font-normal text-primary sm:text-4xl">{title}</h1>
          </header>

          <section className="flex flex-col gap-3">{contentBlocks.map((block, index) => renderMarkdownBlock(block, slug, index))}</section>
        </article>
      </main>
    </div>
  );
}
