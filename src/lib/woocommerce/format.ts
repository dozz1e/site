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
