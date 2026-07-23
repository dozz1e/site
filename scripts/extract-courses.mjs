import { load } from 'cheerio';

function text($el) {
  return $el.text().replace(/\s+/g, ' ').trim();
}

export function extractGroups(categoriasHtml) {
  const $ = load(categoriasHtml);
  return $('.course-group')
    .map((_, el) => {
      const $el = $(el);
      return {
        id: $el.attr('id'),
        title: text($el.find('.group-head h2').first()),
        description: text($el.find('.group-head span').first()),
      };
    })
    .get();
}

export function extractListing(categoriasHtml) {
  const $ = load(categoriasHtml);
  const listing = new Map();

  $('.course-group').each((_, group) => {
    const $group = $(group);
    const groupId = $group.attr('id');

    $group.find('.course-card').each((_, card) => {
      const $card = $(card);
      const href = $card.attr('href') || '';
      const slug = href.replace(/^\/curso\//, '').replace(/\/$/, '');
      const $img = $card.find('.course-image img').first();

      listing.set(slug, {
        groupId,
        image: {
          src: $img.attr('src') || '',
          srcset: $img.attr('srcset') || $img.attr('srcSet') || null,
          sizes: $img.attr('sizes') || null,
        },
        badges: $card
          .find('.badges span')
          .map((_, span) => text($(span)))
          .get(),
        modality: text($card.find('.course-body > p').first()),
        longTitle: $card.hasClass('long-title'),
      });
    });
  });

  return listing;
}

function extractHero($) {
  const $hero = $('.detail-hero');
  const $content = $hero.find('.detail-hero-content');
  const $crumb = $content.find('.detail-crumb');
  const breadcrumbLabel = $crumb
    .clone()
    .children()
    .remove()
    .end()
    .text()
    .replace(/›/g, '')
    .trim();

  return {
    image: $hero.find('img').first().attr('src') || '',
    breadcrumbLabel,
    badges: $content
      .find('.detail-badges span')
      .map((_, span) => text($(span)))
      .get(),
    title: text($content.find('h1').first()),
    subtitle: text($content.find('h1').first().next('p')),
    pdfHref: $content.find('.secondary-detail-btn').attr('href') || null,
  };
}

function extractFacts($) {
  const facts = { duration: '', modality: '', location: '', nextStart: '' };
  const labelToKey = {
    'DURACIÓN': 'duration',
    'MODALIDAD': 'modality',
    'UBICACIÓN': 'location',
    'PRÓXIMO INICIO': 'nextStart',
  };

  $('.detail-facts > div').each((_, div) => {
    const $div = $(div);
    const label = text($div.find('small'));
    const key = labelToKey[label];
    if (key) facts[key] = text($div.find('strong'));
  });

  return facts;
}

function extractIntro($) {
  const $intro = $('.detail-section.intro-section');
  const $lead = $intro.find('p.lead');

  return {
    eyebrow: text($intro.find('p.eyebrow').first()),
    title: text($intro.find('h2').first()),
    lead: text($lead),
    body: text($lead.nextAll('p').first()),
    calloutLabel: text($intro.find('.detail-callout span')),
    calloutText: text($intro.find('.detail-callout strong')),
  };
}

function extractSchedule($) {
  const blocks = [];

  $('.detail-content > .detail-section').each((_, section) => {
    const $section = $(section);
    if ($section.hasClass('intro-section') || $section.hasClass('include-section')) return;

    const options = $section
      .find('.schedule-grid > article')
      .map((_, article) => {
        const $article = $(article);
        return {
          availability: text($article.find('.availability')),
          title: text($article.find('h3')),
          items: $article
            .find('li')
            .map((_, li) => text($(li)))
            .get(),
        };
      })
      .get();

    blocks.push({
      eyebrow: text($section.find('p.eyebrow').first()),
      title: text($section.find('h2').first()),
      body: text($section.find('> p').not('.eyebrow').first()),
      options,
    });
  });

  return blocks;
}

function extractTeachers($) {
  return $('.teacher-section')
    .map((_, section) => {
      const $section = $(section);
      const style = $section.find('.teacher-mark').attr('style') || '';
      const photoMatch = style.match(/url\(['"]?(.*?)['"]?\)/);

      return {
        name: text($section.find('h2').first()),
        photo: photoMatch ? photoMatch[1] : '',
        summary: text($section.find('.teacher-summary')),
        credentials: $section
          .find('.teacher-credentials li')
          .map((_, li) => text($(li)))
          .get(),
        tags: $section
          .find('.teacher-tags span')
          .map((_, span) => text($(span)))
          .get(),
      };
    })
    .get();
}

function extractIncludeSection($) {
  const $section = $('.include-section');
  const $columns = $section.find('> div');

  return {
    includes: $columns
      .eq(0)
      .find('li')
      .map((_, li) => text($(li)))
      .get(),
    requirements: $columns
      .eq(1)
      .find('li')
      .map((_, li) => text($(li)))
      .get(),
  };
}

function extractPrice($) {
  const $section = $('.price-section');
  const $panel = $section.find('.price-panel');
  const delText = $panel.find('del').text().trim();

  return {
    label: text($panel.find('.enroll-label')),
    original: delText || null,
    current: text($panel.find('.price')),
    discountText: $panel.find('.discount').length ? text($panel.find('.discount')) : null,
    reserveText: text($section.find('.price-intro p').not('.eyebrow')),
  };
}

export function extractCourseDetail(courseHtml) {
  const $ = load(courseHtml);
  const diploma = $('.detail-page').hasClass('diploma-detail');
  const includeData = extractIncludeSection($);

  return {
    diploma,
    hero: extractHero($),
    facts: extractFacts($),
    intro: extractIntro($),
    schedule: extractSchedule($),
    teachers: extractTeachers($),
    includes: includeData.includes,
    requirements: includeData.requirements,
    price: extractPrice($),
  };
}

async function main() {
  const { readFile, writeFile, mkdir, readdir } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const here = path.dirname(fileURLToPath(import.meta.url));
  const siteRoot = path.resolve(here, '..');
  const sourceRoot = path.resolve(siteRoot, '..');

  const categoriasHtml = await readFile(path.join(sourceRoot, 'categorias', 'index.html'), 'utf-8');
  const groups = extractGroups(categoriasHtml);
  const listing = extractListing(categoriasHtml);

  await mkdir(path.join(siteRoot, 'src', 'data'), { recursive: true });
  await writeFile(
    path.join(siteRoot, 'src', 'data', 'categoryGroups.json'),
    JSON.stringify(groups, null, 2) + '\n',
  );

  const cursoDir = path.join(sourceRoot, 'curso');
  const slugs = await readdir(cursoDir);
  const outDir = path.join(siteRoot, 'src', 'content', 'curso');
  await mkdir(outDir, { recursive: true });

  let written = 0;
  for (const slug of slugs) {
    const listingEntry = listing.get(slug);
    if (!listingEntry) {
      console.warn(`No listing entry for ${slug}, skipping`);
      continue;
    }

    const courseHtml = await readFile(path.join(cursoDir, slug, 'index.html'), 'utf-8');
    const detail = extractCourseDetail(courseHtml);

    const record = {
      slug,
      groupId: listingEntry.groupId,
      listing: {
        image: listingEntry.image,
        badges: listingEntry.badges,
        modality: listingEntry.modality,
        longTitle: listingEntry.longTitle,
      },
      ...detail,
    };

    await writeFile(path.join(outDir, `${slug}.json`), JSON.stringify(record, null, 2) + '\n');
    written += 1;
  }

  console.log(`Wrote ${written} course files and ${groups.length} category groups.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
