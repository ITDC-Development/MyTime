export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatHours(hours: number): string {
  return hours.toFixed(1).replace('.', ',');
}

export function formatPeriod(startMin: number, endMin: number): string {
  return `${minutesToHHMM(startMin)}–${minutesToHHMM(endMin)}`;
}
