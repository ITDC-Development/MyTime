import axios from 'axios';
import { logger } from '../utils/logger';
import type { ActivityTimelineEvent } from '../types/jira';

const USE_MOCK = process.env.USE_MOCK_DATA === 'true';
const PAGE_SIZE = 200;

// Mapování issueType → typ absence (pro nativní AT eventy)
const ISSUE_TYPE_MAP: Record<string, ActivityTimelineEvent['type']> = {
  'HOLIDAY':   'HOLIDAY',
  'DAY_OFF':   'DAY_OFF',
  'VACATION':  'VACATION',
  'SICK_LEAVE':'SICK_LEAVE',
};

// Mapování summary (lowercase) → typ absence (pro BOOKING custom event typy v AT)
// Booking s tímto summary = absence, ne pracovní booking
const BOOKING_SUMMARY_MAP: Record<string, ActivityTimelineEvent['type']> = {
  'nemoc':      'SICK_LEAVE',
  'sick leave': 'SICK_LEAVE',
  'sick_leave': 'SICK_LEAVE',
  'dovolená':   'VACATION',
  'vacation':   'VACATION',
  'dovolena':   'VACATION',
  'day off':    'DAY_OFF',
  'day_off':    'DAY_OFF',
  'volno':      'DAY_OFF',
};

function extractBookingEventType(summary: string): string {
  const s = summary.trim();

  // Pattern 1: "[Nemoc] ITDC Intern | Doctor visit" → "nemoc"
  const bracketMatch = s.match(/^\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1].trim().toLowerCase();

  // Pattern 2: "ITDC Development | Nemoc" → "nemoc"
  const pipeIdx = s.lastIndexOf(' | ');
  if (pipeIdx !== -1) return s.slice(pipeIdx + 3).trim().toLowerCase();

  return s.toLowerCase();
}

function resolveAbsenceType(issueType: string, summary: string): ActivityTimelineEvent['type'] | null {
  if (ISSUE_TYPE_MAP[issueType]) return ISSUE_TYPE_MAP[issueType];

  if (issueType === 'BOOKING') {
    const candidate = extractBookingEventType(summary);
    if (BOOKING_SUMMARY_MAP[candidate]) return BOOKING_SUMMARY_MAP[candidate];
  }

  return null;
}

function generateMockAbsences(from: string, to: string): ActivityTimelineEvent[] {
  const employees = [
    { user: 'Tomáš Kraus', accountId: 'acc-tomas', type: 'VACATION' as const },
    { user: 'Hana Nová', accountId: 'acc-hana', type: 'SICK_LEAVE' as const },
  ];

  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  const out: ActivityTimelineEvent[] = [];
  let id = 5000;

  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const year = cur.getUTCFullYear();
    const month = cur.getUTCMonth();
    for (const emp of employees) {
      const midDay = 14 + employees.indexOf(emp) * 5;
      const absStart = new Date(Date.UTC(year, month, midDay));
      const absEnd = new Date(Date.UTC(year, month, midDay + 1));
      const startStr = absStart.toISOString().slice(0, 10);
      const endStr = absEnd.toISOString().slice(0, 10);
      if (startStr >= from && startStr <= to) {
        out.push({ id: String(id++), username: emp.user, accountId: emp.accountId, type: emp.type, start: startStr, end: endStr, hours: 16 });
      }
    }
    cur = new Date(Date.UTC(year, month + 1, 1));
  }
  return out;
}

export async function fetchAbsences(from: string, to: string, type?: ActivityTimelineEvent['type']): Promise<ActivityTimelineEvent[]> {
  if (USE_MOCK || !process.env.ACTIVITY_TIMELINE_AUTH_TOKEN) {
    logger.info('Načítám mock absence z Activity Timeline', { from, to });
    const all = generateMockAbsences(from, to);
    return type ? all.filter(a => a.type === type) : all;
  }

  const baseUrl = process.env.ACTIVITY_TIMELINE_BASE_URL!.trim().replace(/\/+$/, '');
  const token = process.env.ACTIVITY_TIMELINE_AUTH_TOKEN!.trim();
  const teamIds = (process.env.ACTIVITY_TIMELINE_TEAM_IDS ?? '').trim()
    .split(',').map(s => s.trim()).filter(Boolean);

  if (teamIds.length === 0) {
    logger.warn('ACTIVITY_TIMELINE_TEAM_IDS není nastaven — absence se nepřenesou');
    return [];
  }

  const seen = new Set<string>();
  const allEvents: ActivityTimelineEvent[] = [];

  for (const teamId of teamIds) {
    let startAt = 0;
    let page = 0;
    let totalEvents = 0;

    while (true) {
      const params = new URLSearchParams({
        start: from, end: to, teamId,
        'auth-token': token,
        maxResults: String(PAGE_SIZE),
        startAt: String(startAt),
      });

      const url = `${baseUrl}/rest/api/1/timeline?${params.toString()}`;
      logger.info('Activity Timeline request', { url: url.replace(token, '***'), page, startAt });

      const response = await axios.get(url);
      const raw = response.data;
      const members: any[] = raw?.members ?? [];
      const total: number | undefined = raw?.total;
      const maxResults: number = raw?.maxResults ?? PAGE_SIZE;
      const hasMore: boolean = raw?.hasMore ?? false;
      let pageEvents = 0;

      // Log unikátních typů a ukázek BOOKING eventů na první stránce
      if (page === 0) {
        const issueTypeCounts: Record<string, number> = {};
        const bookingSamples: string[] = [];
        for (const m of members) {
          for (const iss of m.issues ?? []) {
            const t = iss.issueType ?? '?';
            issueTypeCounts[t] = (issueTypeCounts[t] ?? 0) + 1;
            if (t === 'BOOKING' && bookingSamples.length < 5) {
              bookingSamples.push(`"${iss.summary}" [${iss.projectKey}]`);
            }
          }
        }
        logger.info('Activity Timeline odpověď', {
          teamId, membersCount: members.length,
          totalIssues: members.reduce((s: number, m: any) => s + (m.issues?.length ?? 0), 0),
          issueTypeCounts,
          bookingSamples,
        });
      }

      for (const member of members) {
        const accountId: string = member.username ?? '';
        const username: string = member.userRealName ?? member.username ?? '';

        for (const issue of member.issues ?? []) {
          const issueType: string = issue.issueType ?? issue.type ?? '';
          const summary: string = issue.summary ?? '';
          const absenceType = resolveAbsenceType(issueType, summary);
          if (!absenceType) continue;

          const id = String(issue.id ?? issue.issueKey ?? '');
          if (seen.has(id)) continue;
          seen.add(id);
          pageEvents++;

          const hoursPerDay = issue.dailyTimeEstimate != null
            ? issue.dailyTimeEstimate / 3600
            : null;

          allEvents.push({
            id,
            username,
            accountId,
            type: absenceType,
            start: issue.plannedStart ?? issue.start ?? issue.startDate ?? '',
            end: issue.plannedEnd ?? issue.end ?? issue.endDate ?? issue.plannedStart ?? '',
            hours: issue.hours ?? issue.duration ?? undefined,
            ...(hoursPerDay != null ? { hoursPerDay } : {}),
          });
        }
      }

      totalEvents += pageEvents;
      logger.info('Activity Timeline stránka zpracována', {
        teamId, page, startAt, membersOnPage: members.length, absenceEventsOnPage: pageEvents, totalSoFar: totalEvents,
      });

      const fetched = startAt + members.length;
      const reachedEnd = members.length === 0 || (!hasMore && (total === undefined || fetched >= total));
      if (reachedEnd) break;

      startAt += maxResults;
      page++;
      if (page >= 50) {
        logger.warn('Activity Timeline — dosažen limit 50 stránek', { teamId });
        break;
      }
    }
  }

  if (type) return allEvents.filter(a => a.type === type);
  return allEvents;
}
