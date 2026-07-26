// scripts/generate-overrides.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURSO_DIR = path.join(__dirname, '..', 'src', 'content', 'curso');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'courseOverrides.json');

// The 3 courses whose current hero.pdfHref isn't a /pdfs/{id}.pdf link, resolved
// by exact slug/URL match against a live WooCommerce products list fetch.
const MANUAL_WC_IDS = {
  'marketing-digital': 3276,
  'masaje-relajante-descontracturante': 4148,
  'rotulacion-etiquetado-nutricional': 5795,
};

function resolveWcId(course) {
  const match = (course.hero.pdfHref || '').match(/\/pdfs\/(\d+)\.pdf/);
  if (match) return Number(match[1]);
  const manual = MANUAL_WC_IDS[course.slug];
  if (!manual) throw new Error(`No WooCommerce id resolvable for slug "${course.slug}"`);
  return manual;
}

export function buildOverrides(courses) {
  const overrides = {};

  for (const course of courses) {
    const wcId = resolveWcId(course);
    const entry = {
      slug: course.slug,
      groupId: course.groupId,
      modality: course.facts.modality,
      location: course.facts.location,
      nextStart: course.facts.nextStart,
      diploma: course.diploma,
      title: course.hero.title,
      introTitle: course.intro.title,
      introLead: course.intro.lead,
      calloutText: course.intro.calloutText,
      scheduleEyebrow: course.schedule[0].eyebrow,
      scheduleTitle: course.schedule[0].title,
      scheduleBody: course.schedule[0].body,
      planEstudiosBody: course.schedule[1]?.body ?? '',
      duration: course.facts.duration,
      heroImage: course.hero.image,
      listingImage: course.listing.image,
    };

    const defaultReserve = `Reserva tu cupo para ${course.hero.title}.`;
    if (course.price.reserveText !== defaultReserve) {
      entry.reserveText = course.price.reserveText;
    }

    const standardPdf = `https://cenakin.cl/pdfs/${wcId}.pdf`;
    if (course.hero.pdfHref !== standardPdf) {
      entry.pdfHref = course.hero.pdfHref;
    }

    const defaultCallout = course.diploma ? 'FORMACIÓN FLEXIBLE' : 'FORMACIÓN PRÁCTICA';
    if (course.intro.calloutLabel !== defaultCallout) {
      entry.calloutLabel = course.intro.calloutLabel;
    }

    const horasGuess = course.facts.duration.split(' ')[0];
    const defaultBadges = ['♙ Curso certificado', `◷ ${horasGuess} horas`, `◉ ${course.facts.modality}`];
    if (JSON.stringify(course.listing.badges) !== JSON.stringify(defaultBadges)) {
      entry.listingBadges = course.listing.badges;
    }

    overrides[String(wcId)] = entry;
  }

  return overrides;
}

function main() {
  const files = readdirSync(CURSO_DIR).filter((name) => name.endsWith('.json'));
  const courses = files.map((name) => JSON.parse(readFileSync(path.join(CURSO_DIR, name), 'utf-8')));
  const overrides = buildOverrides(courses);
  const sortedKeys = Object.keys(overrides).sort((a, b) => Number(a) - Number(b));
  const sorted = Object.fromEntries(sortedKeys.map((key) => [key, overrides[key]]));
  writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote ${sortedKeys.length} entries to ${OUTPUT_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
