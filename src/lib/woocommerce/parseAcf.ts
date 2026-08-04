import { load } from 'cheerio';

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function stripCuposSuffix(title: string): string {
  return title.replace(/\s*cupos\s+disponibles\s*$/i, '').trim();
}

export function stripHtml(html: string): string {
  return cleanText(load(`<div>${html}</div>`)('div').first().text());
}

const SECTION_DIVIDER_HEADINGS = ['campo ocupacional', 'perfil egresado', 'perfil del egresado', 'malla curricular'];

export function markSectionDividers(html: string): string {
  const $ = load(`<div>${html}</div>`);
  $('h2, h3').each((_, el) => {
    const text = cleanText($(el).text()).replace(/:\s*$/, '').toLowerCase();
    const isFirstInBorderedWrapper =
      ($(el).parent().hasClass('diploma-profile') || $(el).parent().hasClass('profile-block')) &&
      $(el).is(':first-child');
    if (SECTION_DIVIDER_HEADINGS.includes(text) && !isFirstInBorderedWrapper) {
      $(el).addClass('section-divider');
    }
  });
  return $('div').first().html() ?? html;
}

function leafListItems($: ReturnType<typeof load>, scope: string): string[] {
  return $(scope)
    .find('li')
    .filter((_, li) => $(li).find('ul, ol').length === 0)
    .map((_, li) => cleanText($(li).text()))
    .get()
    .filter((text) => text.length > 0);
}

export function parseIncludes(html: string): string[] {
  const $ = load(`<div>${html}</div>`);
  return leafListItems($, 'div');
}

export function parseRequirements(html: string): string[] {
  const $ = load(`<div>${html}</div>`);
  return leafListItems($, 'div');
}

export interface ScheduleOption {
  title: string;
  items: string[];
}

function leafItemsOf($: ReturnType<typeof load>, ul: ReturnType<ReturnType<typeof load>>): string[] {
  return ul
    .find('li')
    .filter((_, li) => $(li).find('ul, ol').length === 0)
    .map((_, li) => cleanText($(li).text()))
    .get()
    .filter((text) => text.length > 0 && !/^cupos\s+disponibles$/i.test(text));
}

export function parseFormatoOptions(html: string): ScheduleOption[] {
  const $ = load(`<div>${html}</div>`);
  // h3-fallback only matches the "Inicio y acceso" / "Duración y certificación" pair used by
  // fully-online courses (always 2 headings); a single stray h3 (e.g. "Requisitos") is a
  // different section that happens to share the formato field, not a schedule option.
  const headingTag = $('div > h4').length > 0 ? 'h4' : $('div > h3').length >= 2 ? 'h3' : null;

  if (headingTag) {
    const options: ScheduleOption[] = [];
    let current: ScheduleOption | null = null;
    let claimed = false;
    $('div')
      .children()
      .each((_, el) => {
        if (el.tagName === headingTag) {
          if (current) options.push(current);
          current = { title: stripCuposSuffix(cleanText($(el).text())), items: [] };
          claimed = false;
        } else if (el.tagName === 'ul' && current && !claimed) {
          current.items = leafItemsOf($, $(el));
          claimed = true;
        }
      });
    if (current) options.push(current);
    return options.filter((option) => option.items.length > 0);
  }

  // No h3/h4 grouping heading at all (not even an unrelated one, e.g. "Requisitos"):
  // a bare top-level <ul> is the course's single schedule.
  const hasAnyHeading = $('div > h3, div > h4').length > 0;
  const topUl = $('div > ul').first();
  if (!hasAnyHeading && topUl.length > 0) {
    const items = leafItemsOf($, topUl);
    return items.length > 0 ? [{ title: 'Horario', items }] : [];
  }

  return [];
}

export interface ParsedTeacher {
  name: string;
  credentials: string[];
}

export function parseProfesores(blocks: string[]): ParsedTeacher[] {
  return blocks.map((block) => {
    const $ = load(block);
    const name = cleanText($('h4').first().text());
    const credentials = leafListItems($, 'body');
    return { name, credentials };
  });
}
