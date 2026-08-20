const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatCLP(rawPrice: string): string {
  const value = Number(rawPrice);
  return `$${value.toLocaleString('es-CL')}`;
}

export function formatSpanishDate(isoDateTime: string): string {
  const [year, month, day] = isoDateTime.slice(0, 10).split('-').map(Number);
  return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

const ACF_DATE_PATTERN = /^([a-z]+)\s+(\d{1,2}),\s+(\d{4})$/i;

export function parseAcfDate(raw: string): string {
  const match = raw.match(ACF_DATE_PATTERN);
  if (!match) {
    throw new Error(`parseAcfDate: unexpected ACF date format "${raw}"`);
  }
  const [, monthName, day, year] = match;
  const monthIndex = MONTHS_ES.indexOf(monthName.toLowerCase());
  if (monthIndex === -1) {
    throw new Error(`parseAcfDate: unknown Spanish month "${monthName}" in "${raw}"`);
  }
  return `${Number(day)} de ${MONTHS_ES[monthIndex]} de ${year}`;
}
