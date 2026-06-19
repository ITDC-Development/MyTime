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

// Eventy s tímto názvem se nepočítají jako nemoc, i když mají issueType SICK_LEAVE
const SICK_LEAVE_EXCLUSIONS = new Set(['lékař', 'lekar', 'lékar', 'lekár', 'doctor', 'doctor visit']);

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
  const summaryLower = summary.trim().toLowerCase();

  // Eventy pojmenované jako návštěva lékaře se vylučují bez ohledu na issueType
  if (SICK_LEAVE_EXCLUSIONS.has(summaryLower)) return null;

  if (ISSUE_TYPE_MAP[issueType]) return ISSUE_TYPE_MAP[issueType];

  if (issueType === 'BOOKING') {
    const candidate = extractBookingEventType(summary);
    // Pokud část za " | " označuje návštěvu lékaře, vyloučit (např. "[Nemoc] Team | Lékař")
    const pipeIdx = summary.lastIndexOf(' | ');
    if (pipeIdx !== -1) {
      const activity = summary.slice(pipeIdx + 3).trim().toLowerCase();
      if (SICK_LEAVE_EXCLUSIONS.has(activity)) return null;
    }
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

export interface MemberRole {
  accountId: string;
  displayName: string;
  role: 'user' | 'freelancer';
  country?: 'CZ' | 'SK';
}

function roleFromPosition(positionNameLong: string | undefined): 'user' | 'freelancer' {
  // Pouze explicitní "Freelancer" pozice → freelancer, vše ostatní (Zaměstnanec, Praktikant, ...) → user
  if (positionNameLong?.toLowerCase() === 'freelancer') return 'freelancer';
  return 'user';
}

function buildTeamCountryMap(): Map<string, 'CZ' | 'SK'> {
  const map = new Map<string, 'CZ' | 'SK'>();
  for (const id of (process.env.ACTIVITY_TIMELINE_CZ_TEAM_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    map.set(id, 'CZ');
  }
  for (const id of (process.env.ACTIVITY_TIMELINE_SK_TEAM_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    map.set(id, 'SK');
  }
  return map;
}

function getAllTeamIds(): string[] {
  const generic = (process.env.ACTIVITY_TIMELINE_TEAM_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const cz = (process.env.ACTIVITY_TIMELINE_CZ_TEAM_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const sk = (process.env.ACTIVITY_TIMELINE_SK_TEAM_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  // CZ/SK musí být první — seen set by jinak označil členy bez country z generického týmu
  return [...new Set([...cz, ...sk, ...generic])];
}

export async function fetchMemberRoles(from: string, to: string): Promise<MemberRole[]> {
  if (USE_MOCK || !process.env.ACTIVITY_TIMELINE_AUTH_TOKEN) {
    return [
      { accountId: 'acc-tomas', displayName: 'Tomáš Kraus', role: 'user', country: 'CZ' },
      { accountId: 'acc-hana', displayName: 'Hana Nová', role: 'user', country: 'CZ' },
    ];
  }

  const baseUrl = process.env.ACTIVITY_TIMELINE_BASE_URL!.trim().replace(/\/+$/, '');
  const token = process.env.ACTIVITY_TIMELINE_AUTH_TOKEN!.trim();
  const teamIds = getAllTeamIds();
  const teamCountryMap = buildTeamCountryMap();

  if (teamIds.length === 0) return [];

  const seen = new Set<string>();
  const roles: MemberRole[] = [];

  for (const teamId of teamIds) {
    const country = teamCountryMap.get(teamId);
    let startAt = 0;
    let page = 0;

    while (true) {
      const params = new URLSearchParams({
        start: from, end: to, teamId,
        'auth-token': token,
        maxResults: String(PAGE_SIZE),
        startAt: String(startAt),
      });

      let response: any;
      try {
        response = await axios.get(`${baseUrl}/rest/api/1/timeline?${params.toString()}`);
      } catch (err: any) {
        logger.warn('AT member roles — team přeskočen', { teamId, status: err?.response?.status });
        break;
      }
      const raw = response.data;
      const members: any[] = raw?.members ?? [];
      const hasMore: boolean = raw?.hasMore ?? false;
      const total: number | undefined = raw?.total;

      for (const member of members) {
        const accountId: string = member.username ?? '';
        if (!accountId || seen.has(accountId)) continue;
        seen.add(accountId);
        const displayName: string = member.userRealName ?? member.username ?? accountId;
        roles.push({ accountId, displayName, role: roleFromPosition(member.personPosition?.positionNameLong), country });
      }

      const fetched = startAt + members.length;
      if (members.length === 0 || (!hasMore && (total === undefined || fetched >= total))) break;
      startAt += PAGE_SIZE;
      page++;
      if (page >= 50) break;
    }
  }

  logger.info('AT member roles načteny', { total: roles.length, freelancers: roles.filter(r => r.role === 'freelancer').length });
  return roles;
}

export async function fetchAbsences(from: string, to: string, knownMemberRoles?: MemberRole[], type?: ActivityTimelineEvent['type']): Promise<ActivityTimelineEvent[]> {
  if (USE_MOCK || !process.env.ACTIVITY_TIMELINE_AUTH_TOKEN) {
    logger.info('Načítám mock absence z Activity Timeline', { from, to });
    const all = generateMockAbsences(from, to);
    return type ? all.filter(a => a.type === type) : all;
  }

  const baseUrl = process.env.ACTIVITY_TIMELINE_BASE_URL!.trim().replace(/\/+$/, '');
  const token = process.env.ACTIVITY_TIMELINE_AUTH_TOKEN!.trim();
  const teamIds = getAllTeamIds();

  if (teamIds.length === 0) {
    logger.warn('ACTIVITY_TIMELINE_TEAM_IDS / CZ_TEAM_IDS / SK_TEAM_IDS není nastaven — absence se nepřenesou');
    return [];
  }

  const teamCountryMap = buildTeamCountryMap();
  // Map accountId → member's own country (from country-specific team membership)
  const memberCountryMap = new Map<string, 'CZ' | 'SK'>();
  if (knownMemberRoles) {
    for (const m of knownMemberRoles) {
      if (m.country) memberCountryMap.set(m.accountId, m.country);
    }
  }

  const seen = new Set<string>();
  const allEvents: ActivityTimelineEvent[] = [];

  for (const teamId of teamIds) {
    const teamCountry = teamCountryMap.get(teamId); // 'CZ', 'SK', or undefined for generic
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

      let response: any;
      try {
        response = await axios.get(url);
      } catch (err: any) {
        logger.warn('Activity Timeline team přeskočen', { teamId, status: err?.response?.status });
        break;
      }
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

          // For HOLIDAY events from a country-specific team, skip if member belongs to a different country.
          // Prevents CZ team holidays (e.g. May 8) from being written for SK employees.
          if (absenceType === 'HOLIDAY' && teamCountry) {
            const memberCountry = memberCountryMap.get(accountId);
            if (memberCountry && memberCountry !== teamCountry) continue;
          }

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

function isTerminBooking(summary: string): boolean {
  const key = extractBookingEventType(summary);
  return key === 'termín' || key === 'termin';
}

function parseTerminTags(summary: string): {
  issueKey: string;
  parentKey: string;
  parentSummary: string;
  components: string[];
  sprint: string;
  comment: string;
  summary: string;
} {
  const tags: Record<string, string> = {};
  const pattern = /\[([^\]:]+):\s*([^\]]+)\]/g;
  let m;
  while ((m = pattern.exec(summary)) !== null) {
    tags[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return {
    issueKey:      tags['issue'] ?? '',
    parentKey:     tags['parent-klic'] ?? tags['parent-klíč'] ?? '',
    parentSummary: tags['parent-nazev'] ?? tags['parent-název'] ?? '',
    components:    tags['komponenta'] ? [tags['komponenta']] : [],
    sprint:        tags['sprint'] ?? '',
    comment:       tags['komentar'] ?? tags['komentář'] ?? '',
    summary:       tags['nazev'] ?? tags['název'] ?? '',
  };
}

export interface AtWorklogEntry {
  worklogId: string;
  user: string;
  accountId: string;
  summary: string;
  parentKey: string;
  parentSummary: string;
  parentIssueType: string;
  components: string[];
  sprint: string;
  comment: string;
  seconds: number;
  started: string;
  issueKey: string;
  date: string;
  issueType: 'TERMIN';
  priority: string;
  source: 'activity_timeline';
}

export async function fetchTerminEvents(from: string, to: string): Promise<AtWorklogEntry[]> {
  if (USE_MOCK || !process.env.ACTIVITY_TIMELINE_AUTH_TOKEN) return [];

  const baseUrl = process.env.ACTIVITY_TIMELINE_BASE_URL!.trim().replace(/\/+$/, '');
  const token = process.env.ACTIVITY_TIMELINE_AUTH_TOKEN!.trim();
  const teamIds = getAllTeamIds();
  if (teamIds.length === 0) return [];

  const seen = new Set<string>();
  const result: AtWorklogEntry[] = [];

  for (const teamId of teamIds) {
    let startAt = 0;
    let page = 0;

    while (true) {
      const params = new URLSearchParams({
        start: from, end: to, teamId,
        'auth-token': token,
        maxResults: String(PAGE_SIZE),
        startAt: String(startAt),
      });

      let response: any;
      try {
        response = await axios.get(`${baseUrl}/rest/api/1/timeline?${params.toString()}`);
      } catch (err: any) {
        logger.warn('AT Termíny — team přeskočen', { teamId, status: err?.response?.status });
        break;
      }

      const raw = response.data;
      const members: any[] = raw?.members ?? [];
      const hasMore: boolean = raw?.hasMore ?? false;
      const total: number | undefined = raw?.total;

      for (const member of members) {
        const accountId: string = member.username ?? '';
        const username: string = member.userRealName ?? member.username ?? '';

        for (const issue of member.issues ?? []) {
          const issueType: string = issue.issueType ?? '';
          const summary: string = issue.summary ?? '';
          if (issueType !== 'BOOKING' || !isTerminBooking(summary)) continue;

          const id = String(issue.id ?? issue.issueKey ?? '');
          if (seen.has(id)) continue;
          seen.add(id);

          const hoursPerDay = issue.dailyTimeEstimate != null
            ? issue.dailyTimeEstimate / 3600
            : 8;

          const startDate = issue.plannedStart ?? issue.start ?? issue.startDate ?? '';
          const endDate = issue.plannedEnd ?? issue.end ?? issue.endDate ?? startDate;
          if (!startDate) continue;

          const cur = new Date(startDate + 'T00:00:00Z');
          const endDt = new Date(endDate + 'T00:00:00Z');
          let dayIndex = 0;

          const tags = parseTerminTags(summary);
          while (cur <= endDt) {
            const date = cur.toISOString().slice(0, 10);
            if (date >= from && date <= to) {
              result.push({
                worklogId: `AT-${id}-${dayIndex}`,
                user: username,
                accountId,
                summary: tags.summary,
                parentKey: tags.parentKey,
                parentSummary: tags.parentSummary,
                parentIssueType: '',
                components: tags.components,
                sprint: tags.sprint,
                comment: tags.comment,
                seconds: Math.round(hoursPerDay * 3600),
                started: `${date}T08:00:00.000+0000`,
                issueKey: tags.issueKey || `AT-${id}`,
                date,
                issueType: 'TERMIN',
                priority: '',
                source: 'activity_timeline',
              });
            }
            dayIndex++;
            cur.setUTCDate(cur.getUTCDate() + 1);
          }
        }
      }

      const fetched = startAt + members.length;
      if (members.length === 0 || (!hasMore && (total === undefined || fetched >= total))) break;
      startAt += PAGE_SIZE;
      page++;
      if (page >= 50) break;
    }
  }

  logger.info('AT Termíny načteny', { total: result.length, from, to });
  return result;
}
