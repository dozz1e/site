import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import blogCategories from '../data/blogCategories.json';
import blogAuthors from '../data/blogAuthors.json';
import overridesJson from '../data/courseOverrides.json';
import teachersJson from '../data/teachers.json';
import categoryGroups from '../data/categoryGroups.json';
import { fetchProduct, isInCoursesCategory, COURSES_CATEGORY_ID } from '../lib/woocommerce/client.ts';
import { transformProduct } from '../lib/woocommerce/transform.ts';
import type { CourseOverride } from '../lib/woocommerce/transform.ts';

const overrides = overridesJson as Record<string, CourseOverride>;
const groupTitleById = Object.fromEntries(categoryGroups.map((group) => [group.id, group.title]));

const curso = defineCollection({
  loader: async () => {
    const entries = await Promise.all(
      Object.entries(overrides).map(async ([wcId, override]) => {
        const product = await fetchProduct(wcId);
        if (!isInCoursesCategory(product)) {
          console.warn(`[curso] ${wcId} "${product.name}" omitido: no tiene la categoría Cursos (${COURSES_CATEGORY_ID}) en WooCommerce`);
          return null;
        }
        const groupTitle = groupTitleById[override.groupId];
        if (!groupTitle) {
          throw new Error(`courseOverrides.json entry ${wcId} has unknown groupId "${override.groupId}"`);
        }
        const data = transformProduct(product, wcId, override, teachersJson, groupTitle);
        return { id: wcId, ...data };
      }),
    );
    return entries.filter((entry) => entry !== null);
  },
  schema: z.object({
    slug: z.string(),
    previousSlugs: z.array(z.string()).default([]),
    groupId: z.string(),
    diploma: z.boolean(),
    listing: z.object({
      image: z.string(),
      badges: z.array(z.string()),
      modality: z.string(),
      longTitle: z.boolean(),
    }),
    hero: z.object({
      image: z.string(),
      ogImage: z.string(),
      breadcrumbLabel: z.string(),
      badges: z.array(z.string()),
      title: z.string(),
      compactTitle: z.boolean(),
      subtitle: z.string(),
      pdfHref: z.string().nullable(),
      hasAvailability: z.boolean(),
    }),
    facts: z.object({
      duration: z.string(),
      modality: z.string(),
      location: z.string(),
      nextStart: z.string(),
    }),
    intro: z.object({
      eyebrow: z.string(),
      title: z.string(),
      lead: z.string(),
      body: z.string(),
      calloutLabel: z.string(),
      calloutText: z.string(),
    }),
    schedule: z.array(
      z.object({
        eyebrow: z.string(),
        title: z.string(),
        body: z.string(),
        bodyHtml: z.string().optional(),
        pdfHref: z.string().optional(),
        options: z.array(
          z.object({
            title: z.string(),
            items: z.array(z.string()),
          }),
        ),
      }),
    ),
    teachers: z.array(
      z.object({
        name: z.string(),
        photo: z.string(),
        summary: z.string(),
        credentials: z.array(z.string()),
        tags: z.array(z.string()),
      }),
    ),
    includes: z.array(z.string()),
    requirements: z.array(z.string()),
    price: z.object({
      label: z.string(),
      original: z.string().nullable(),
      current: z.string(),
      discountText: z.string().nullable(),
      reserveText: z.string(),
    }),
  }),
});

// Blog: un archivo Markdown por artículo en src/content/blog/. El nombre del archivo es la URL (/blog/<archivo>/).
const blogCategoryIds = blogCategories.map((category) => category.id) as [string, ...string[]];
const blogAuthorIds = Object.keys(blogAuthors) as [string, ...string[]];

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string(),
    description: z.string(),
    category: z.enum(blogCategoryIds),
    kicker: z.string(),
    lead: z.string(),
    breadcrumb: z.string(),
    schemaName: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.enum(blogAuthorIds),
    // Ruta base sin extensión: se usan <image>.webp, <image>-640.webp y <image>.jpg
    image: z.string(),
    imageAlt: z.string(),
    order: z.number().default(999),
    toc: z.array(z.object({ id: z.string(), label: z.string() })).default([]),
    related: z.array(z.string()).default([]),
    sources: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { curso, blog };
