export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  const str = rounded.toFixed(2).replace('.', ',');
  return str.replace(',00', '').replace(/,(\d)0$/, ',$1');
}

export function formatPeriod(startMin: number, endMin: number): string {
  return `${minutesToHHMM(startMin)}–${minutesToHHMM(endMin)}`;
}
