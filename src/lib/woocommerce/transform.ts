// src/lib/woocommerce/transform.ts
import { parseIncludes, parseRequirements, parseFormatoOptions, parseProfesores } from './parseAcf.ts';
import { formatCLP, formatSpanishDate } from './format.ts';
import type { WooCommerceProduct } from './client.ts';

export interface CourseOverride {
  slug: string;
  groupId: string;
  modality: string;
  location: string;
  nextStart: string;
  diploma: boolean;
  title: string;
  introTitle: string;
  introLead: string;
  calloutText: string;
  scheduleEyebrow: string;
  scheduleTitle: string;
  scheduleBody: string;
  planEstudiosBody: string;
  duration: string;
  reserveText?: string;
  pdfHref?: string;
  calloutLabel?: string;
  listingBadges?: string[];
}

export interface TeacherRegistryEntry {
  photo: string;
  summary: string;
  tags: string[];
}

export type TeacherRegistry = Record<string, TeacherRegistryEntry>;

export function transformProduct(
  product: WooCommerceProduct,
  wcId: string,
  override: CourseOverride,
  teachers: TeacherRegistry,
  groupTitle: string,
) {
  const modality = override.modality;
  const onSale = product.on_sale;

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
  const reserveText = override.reserveText ?? `Reserva tu cupo para ${override.title}.`;
  const calloutLabel =
    override.calloutLabel ?? (override.diploma ? 'FORMACIÓN FLEXIBLE' : 'FORMACIÓN PRÁCTICA');
  const listingBadges = override.listingBadges ?? [
    '♙ Curso certificado',
    `◷ ${product.acf.horas} horas`,
    `◉ ${modality}`,
  ];

  const priceRaw = onSale ? product.sale_price : product.regular_price;
  const discountText =
    onSale && product.date_on_sale_to
      ? `${override.diploma ? 'Válido' : 'Descuento válido'} hasta el ${formatSpanishDate(product.date_on_sale_to)}`
      : null;

  return {
    slug: override.slug,
    groupId: override.groupId,
    diploma: override.diploma,
    listing: {
      image: `https://cenakin.cl/images/cursos/${product.slug}/mini.webp`,
      badges: listingBadges,
      modality,
      longTitle: override.title.length > 70,
    },
    hero: {
      image: `https://cenakin.cl/images/cursos/${product.slug}/1@3x.webp`,
      breadcrumbLabel: groupTitle,
      badges: [override.diploma ? 'DIPLOMADO CERTIFICADO' : 'CURSO CERTIFICADO', modality.toUpperCase()],
      title: override.title,
      subtitle: override.introLead,
      pdfHref,
    },
    facts: {
      duration: override.duration,
      modality,
      location: override.location,
      nextStart: override.nextStart,
    },
    intro: {
      eyebrow: 'SOBRE ESTA FORMACIÓN',
      title: override.introTitle,
      lead: override.introLead,
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
        bodyHtml: product.acf.plan_estudios,
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
