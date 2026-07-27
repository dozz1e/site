import { defineCollection, z } from 'astro:content';
import overridesJson from '../data/courseOverrides.json';
import teachersJson from '../data/teachers.json';
import categoryGroups from '../data/categoryGroups.json';
import { fetchProduct } from '../lib/woocommerce/client.ts';
import { transformProduct } from '../lib/woocommerce/transform.ts';
import type { CourseOverride } from '../lib/woocommerce/transform.ts';

const overrides = overridesJson as Record<string, CourseOverride>;
const groupTitleById = Object.fromEntries(categoryGroups.map((group) => [group.id, group.title]));

const curso = defineCollection({
  loader: async () => {
    const entries = await Promise.all(
      Object.entries(overrides).map(async ([wcId, override]) => {
        const product = await fetchProduct(wcId);
        const groupTitle = groupTitleById[override.groupId];
        if (!groupTitle) {
          throw new Error(`courseOverrides.json entry ${wcId} has unknown groupId "${override.groupId}"`);
        }
        const data = transformProduct(product, wcId, override, teachersJson, groupTitle);
        return { id: wcId, ...data };
      }),
    );
    return entries;
  },
  schema: z.object({
    slug: z.string(),
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
      breadcrumbLabel: z.string(),
      badges: z.array(z.string()),
      title: z.string(),
      subtitle: z.string(),
      pdfHref: z.string().nullable(),
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

export const collections = { curso };
