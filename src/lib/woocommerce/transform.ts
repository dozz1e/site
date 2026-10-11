// src/lib/woocommerce/transform.ts
import { parseIncludes, parseRequirements, parseFormatoOptions, parseProfesores, markSectionDividers, stripHtml } from './parseAcf.ts';
import { formatCLP, formatSpanishDate, parseAcfDate } from './format.ts';
import type { WooCommerceProduct } from './client.ts';

export interface CourseOverride {
  // La URL del curso es el slug del producto en WooCommerce. Aquí van las URLs anteriores,
  // que se publican como redirecciones hacia la actual.
  previousSlugs?: string[];
  // Carpeta de imágenes en cenakin.cl/images/cursos/ cuando no coincide con el slug de WooCommerce.
  imageSlug?: string;
  groupId: string;
  modality: string;
  location: string;
  nextStart?: string;
  diploma: boolean;
  introTitle: string;
  introLead: string;
  calloutText: string;
  scheduleEyebrow: string;
  scheduleTitle: string;
  scheduleBody: string;
  planEstudiosBody: string;
  duration?: string;
  reserveText?: string;
  pdfHref?: string;
  calloutLabel?: string;
  listingBadges?: string[];
  listingLongTitle?: boolean;
}

export interface TeacherRegistryEntry {
  photo: string;
  summary: string;
  tags: string[];
}

export type TeacherRegistry = Record<string, TeacherRegistryEntry>;

const PURE_HORAS_PATTERN = /^\d+ horas$/;

export function transformProduct(
  product: WooCommerceProduct,
  wcId: string,
  override: CourseOverride,
  teachers: TeacherRegistry,
  groupTitle: string,
) {
  const modality = override.modality;
  const onSale = product.on_sale;
  const title = product.name;

  const teachersData = parseProfesores(product.acf.profesores).map(({ name, credentials }) => {
    const registryEntry = teachers[name];
    if (!registryEntry) {
      throw new Error(`teachers.json missing entry for "${name}" (WooCommerce product ${wcId})`);
    }
    return {
      name,
      photo: registryEntry.photo,
      summary: registryEntry.summary,
      credentials,
      tags: registryEntry.tags,
    };
  });

  const pdfHref = override.pdfHref ?? `https://cenakin.cl/pdfs/${wcId}.pdf`;
  const reserveText = override.reserveText ?? `Reserva tu cupo para ${title}.`;
  const calloutLabel =
    override.calloutLabel ?? (override.diploma ? 'FORMACIÓN FLEXIBLE' : 'FORMACIÓN PRÁCTICA');
  const listingBadges = override.listingBadges ?? [
    '♙ Curso certificado',
    `◷ ${product.acf.horas} horas`,
    `◉ ${modality}`,
  ];

  const nextStart = product.acf.fecha_inicio ? parseAcfDate(product.acf.fecha_inicio) : override.nextStart;
  if (!nextStart) {
    throw new Error(
      `courseOverrides.json entry ${wcId} is missing nextStart (no acf.fecha_inicio and no override.nextStart)`,
    );
  }

  const derivedDuration = product.acf.horas ? `${product.acf.horas} horas` : undefined;
  const duration =
    override.duration && !PURE_HORAS_PATTERN.test(override.duration)
      ? override.duration
      : (derivedDuration ?? override.duration);
  if (!duration) {
    throw new Error(
      `courseOverrides.json entry ${wcId} is missing duration (no acf.horas and no override.duration)`,
    );
  }

  const priceRaw = onSale ? product.sale_price : product.regular_price;
  const discountText =
    onSale && product.date_on_sale_to
      ? `${override.diploma ? 'Válido' : 'Descuento válido'} hasta el ${formatSpanishDate(product.date_on_sale_to)}`
      : null;

  const imageSlug = override.imageSlug ?? product.slug;

  return {
    slug: product.slug,
    previousSlugs: (override.previousSlugs ?? []).filter((previous) => previous !== product.slug),
    groupId: override.groupId,
    diploma: override.diploma,
    listing: {
      image: `https://cenakin.cl/images/cursos/${imageSlug}/mini.webp`,
      badges: listingBadges,
      modality,
      longTitle: override.listingLongTitle ?? title.length > 70,
    },
    hero: {
      image: `https://cenakin.cl/images/cursos/${imageSlug}/1@3x.webp`,
      ogImage: `https://cenakin.cl/images/cursos/${imageSlug}/1.jpg`,
      breadcrumbLabel: groupTitle,
      badges: [override.diploma ? 'DIPLOMADO CERTIFICADO' : 'CURSO CERTIFICADO', modality.toUpperCase()],
      title,
      compactTitle: title.length > 60,
      subtitle: override.introLead,
      pdfHref,
      hasAvailability: product.stock_status === 'instock',
    },
    facts: {
      duration,
      modality,
      location: override.location,
      nextStart,
    },
    intro: {
      eyebrow: 'SOBRE ESTA FORMACIÓN',
      title: override.introTitle,
      lead: stripHtml(product.short_description),
      body: product.acf.objetivo,
      calloutLabel,
      calloutText: override.calloutText,
    },
    schedule: [
      {
        eyebrow: override.scheduleEyebrow,
        title: override.scheduleTitle,
        body: override.scheduleBody,
        options: parseFormatoOptions(product.acf.formato),
      },
      {
        eyebrow: 'CONTENIDOS',
        title: 'Plan de estudios',
        body: override.planEstudiosBody,
        bodyHtml: markSectionDividers(product.acf.plan_estudios),
        pdfHref,
        options: [],
      },
    ],
    teachers: teachersData,
    includes: parseIncludes(product.acf.incluye),
    requirements: parseRequirements(product.acf.dirigido),
    price: {
      label: onSale ? 'DESCUENTO VIGENTE' : 'ARANCEL TOTAL',
      original: onSale ? formatCLP(product.regular_price) : null,
      current: formatCLP(priceRaw),
      discountText,
      reserveText,
    },
  };
}
