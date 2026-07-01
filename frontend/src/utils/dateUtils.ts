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

export interface DateRangePreset {
  label: string;
  from: string;
  to: string;
}

// Rychlé předvolby pro výběr rozsahu datumů — týden začíná pondělím,
// rozsahy zasahující do aktuálního období se nikdy neprotáhnou do budoucnosti.
export function getDateRangePresets(): DateRangePreset[] {
  const today = dayjs();
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');

  const dow = today.day(); // 0 = neděle, 1 = pondělí, ..., 6 = sobota
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const mondayThisWeek = today.subtract(daysSinceMonday, 'day');
  const mondayLastWeek = mondayThisWeek.subtract(7, 'day');
  const sundayLastWeek = mondayLastWeek.add(6, 'day');
  const lastMonth = today.subtract(1, 'month');

  return [
    { label: 'Dnes', from: fmt(today), to: fmt(today) },
    { label: 'Včera', from: fmt(today.subtract(1, 'day')), to: fmt(today.subtract(1, 'day')) },
    { label: 'Tento týden', from: fmt(mondayThisWeek), to: fmt(today) },
    { label: 'Minulý týden', from: fmt(mondayLastWeek), to: fmt(sundayLastWeek) },
    { label: 'Tento měsíc', from: fmt(today.startOf('month')), to: fmt(today) },
    { label: 'Minulý měsíc', from: fmt(lastMonth.startOf('month')), to: fmt(lastMonth.endOf('month')) },
    { label: 'Tento rok', from: fmt(today.startOf('year')), to: fmt(today) },
  ];
}
