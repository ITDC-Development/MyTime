/**
 * Jednoduchý smoke test pro linearizaci.
 * Spuštění: npx tsx tests/linearTime.test.ts (vyžaduje tsx nebo ts-node)
 */
import { linearizeDay } from '../frontend/src/utils/linearTime';

const items = [
  {
    worklogId: '1', accountId: 'a', user: 'A', date: '2026-05-01',
    started: '2026-05-01T08:30:00Z', seconds: 3600 * 2,
    summary: 'Issue 1', issueKey: 'X-1', parentKey: '', parentSummary: '',
    components: [], sprint: '', comment: '', isEdited: false, isManual: false,
  },
  {
    worklogId: '2', accountId: 'a', user: 'A', date: '2026-05-01',
    started: '2026-05-01T10:30:00Z', seconds: 3600 * 4,
    summary: 'Issue 2', issueKey: 'X-2', parentKey: '', parentSummary: '',
    components: [], sprint: '', comment: '', isEdited: false, isManual: false,
  },
];

const result = linearizeDay(items);
console.log('Segmentů:', result.length);
result.forEach(r => {
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  console.log(`  ${fmt(r.startMinutes)}-${fmt(r.endMinutes)}  ${r.isPause ? 'PAUZA' : r.summary}${r.isOvertime ? ' [PŘESČAS]' : ''}`);
}); 

// Očekávané chování: 8:00-10:00 první, 10:00-12:00 druhý, 12:00-12:30 pauza, 12:30-14:30 zbytek
const pauseFound = result.some(r => r.isPause);
console.log('Pauza vložena:', pauseFound ? 'ANO' : 'NE');
console.log('Test', pauseFound ? 'PROŠEL' : 'SELHAL');
process.exit(pauseFound ? 0 : 1);
