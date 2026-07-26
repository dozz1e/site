import { load } from 'cheerio';

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
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

export function parseFormatoOptions(html: string): ScheduleOption[] {
  const $ = load(`<div>${html}</div>`);
  return $('h4')
    .map((_, h4) => {
      const title = cleanText($(h4).text());
      const ul = $(h4).nextAll('ul').first();
      const items = ul
        .find('li')
        .filter((_, li) => $(li).find('ul, ol').length === 0)
        .map((_, li) => cleanText($(li).text()))
        .get()
        .filter((text) => text.length > 0);
      return { title, items };
    })
    .get();
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
