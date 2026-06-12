import { useEffect, useState } from 'react';

const cache = new Map<string, Set<string>>();

export function usePublicHolidays(year: number, countryCode: 'CZ' | 'SK' | null | undefined): Set<string> {
  const [dates, setDates] = useState<Set<string>>(() => {
    if (!countryCode) return new Set();
    return cache.get(`${year}-${countryCode}`) ?? new Set();
  });

  useEffect(() => {
    if (!countryCode) { setDates(new Set()); return; }
    const key = `${year}-${countryCode}`;
    if (cache.has(key)) { setDates(cache.get(key)!); return; }
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { date: string }[]) => {
        const s = new Set(data.map(h => h.date));
        cache.set(key, s);
        setDates(s);
      })
      .catch(() => setDates(new Set()));
  }, [year, countryCode]);

  return dates;
}
