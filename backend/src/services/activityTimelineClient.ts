import axios from 'axios';
import { logger } from '../utils/logger';
import type { ActivityTimelineEvent } from '../types/jira';

const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

function generateMockAbsences(from: string, to: string): ActivityTimelineEvent[] {
  const employees = [
    { user: 'Tomáš Kraus', accountId: 'acc-tomas' },
    { user: 'Hana Nová', accountId: 'acc-hana' },
  ];
  const out: ActivityTimelineEvent[] = [];
  let id = 5000;
  // Tomáš měl pár dní dovolené uprostřed května
  const dates = ['2026-05-14', '2026-05-15'];
  for (const date of dates) {
    out.push({
      id: String(id++),
      username: employees[0].user,
      accountId: employees[0].accountId,
      type: 'VACATION',
      start: date,
      end: date,
      hours: 8,
    });
  }
  // Hana nemoc
  out.push({
    id: String(id++),
    username: employees[1].user,
    accountId: employees[1].accountId,
    type: 'SICK_LEAVE',
    start: '2026-05-20',
    end: '2026-05-21',
    hours: 16,
  });
  return out.filter(e => e.start >= from && e.start <= to);
}

export async function fetchAbsences(from: string, to: string, type?: ActivityTimelineEvent['type']): Promise<ActivityTimelineEvent[]> {
  if (USE_MOCK || !process.env.ACTIVITY_TIMELINE_AUTH_TOKEN) {
    logger.info('Načítám mock absence z Activity Timeline', { from, to, type });
    const all = generateMockAbsences(from, to);
    return type ? all.filter(a => a.type === type) : all;
  }

  const baseUrl = process.env.ACTIVITY_TIMELINE_BASE_URL!;
  const token = process.env.ACTIVITY_TIMELINE_AUTH_TOKEN!;
  const params = new URLSearchParams({
    start: from,
    end: to,
    'auth-token': token,
  });
  if (type) params.set('eventType', type);

  const url = `${baseUrl}/rest/api/1/timeline/admin?${params.toString()}`;
  const response = await axios.get(url);
  return (response.data?.events ?? []) as ActivityTimelineEvent[];
}
