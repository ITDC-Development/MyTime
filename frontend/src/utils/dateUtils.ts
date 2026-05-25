import dayjs from 'dayjs';
import 'dayjs/locale/cs';
dayjs.locale('cs');

export const MONTHS_CZ = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_CZ[month - 1]} ${year}`;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = dayjs().year(year).month(month - 1).date(1).format('YYYY-MM-DD');
  const to = dayjs(from).endOf('month').format('YYYY-MM-DD');
  return { from, to };
}

export function formatDateShort(date: string): string {
  return dayjs(date).format('DD. MM.');
}

export function formatDateFull(date: string): string {
  return dayjs(date).format('DD. MM. YYYY');
}

export function currentMonth(): { year: number; month: number } {
  const now = dayjs();
  return { year: now.year(), month: now.month() + 1 };
}
