import { getCollection, type CollectionEntry } from 'astro:content';
import blogCategories from '../../data/blogCategories.json';

export type BlogPost = CollectionEntry<'blog'>;

const categoryLabel = Object.fromEntries(blogCategories.map((category) => [category.id, category.label]));

export function getCategoryLabel(id: string): string {
  return categoryLabel[id] ?? id;
}

/** Artículos publicados, del más reciente al más antiguo (a igual fecha, por `order`). */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.data.order - b.data.order,
  );
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
