import { defineCollection, z } from 'astro:content';

const curso = defineCollection({
  type: 'data',
  schema: z.object({
    slug: z.string(),
    groupId: z.string(),
    diploma: z.boolean(),
    listing: z.object({
      image: z.object({
        src: z.string(),
        srcset: z.string().nullable(),
        sizes: z.string().nullable(),
      }),
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
        options: z.array(
          z.object({
            availability: z.string(),
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
