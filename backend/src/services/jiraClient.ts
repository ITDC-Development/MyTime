import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import type { JiraWorklogResponse } from '../types/jira';

const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

function generateMockWorklogs(from: string, to: string): JiraWorklogResponse[] {
  const start = new Date(from);
  const end = new Date(to);
  const employees = [
    { user: 'Tomáš Kraus', accountId: 'acc-tomas' },
    { user: 'Hana Nová', accountId: 'acc-hana' },
    { user: 'Pavel Dvořák', accountId: 'acc-pavel' },
  ];
  const issues = [
    { key: 'ENBW-2125', summary: 'Push-Jobs einplanen', parentKey: 'ENBW-35', parent: 'PM :: MOPO', components: ['SAP PM Custom Code'], issueType: 'Task', priority: 'Medium' },
    { key: 'ENBW-2108', summary: 'Review change requests', parentKey: 'ENBW-35', parent: 'PM :: MOPO', components: ['SAP PM Custom Code'], issueType: 'Bug', priority: 'High' },
    { key: 'ENBW-2110', summary: 'Implementace endpointu', parentKey: 'ENBW-35', parent: 'PM :: MOPO', components: ['SAP PM Custom Code'], issueType: 'Story', priority: 'Low' },
  ];

  const result: JiraWorklogResponse[] = [];
  let wid = 1000;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    for (const emp of employees) {
      const numEntries = 2 + Math.floor(Math.random() * 3);
      let startHour = 8 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numEntries; i++) {
        const issue = issues[Math.floor(Math.random() * issues.length)];
        const hours = 1 + Math.floor(Math.random() * 3);
        const startedAt = new Date(d);
        startedAt.setHours(startHour, 0, 0, 0);
        result.push({
          worklogId: String(wid++),
          user: emp.user,
          accountId: emp.accountId,
          summary: issue.summary,
          parentKey: issue.parentKey,
          parentSummary: issue.parent,
          components: issue.components,
          sprint: 'ENBW Sprint Květen 2026',
          issueType: issue.issueType,
          priority: issue.priority,
          comment: '',
          seconds: hours * 3600,
          started: startedAt.toISOString(),
          issueKey: issue.key,
        });
        startHour += hours;
      }
    }
  }
  return result;
}

function makeJiraClient(baseUrl: string, email: string, token: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl,
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
}

export function splitIntoMonths(from: string, to: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end) {
    const chunkFrom = cur < start ? from : cur.toISOString().slice(0, 10);
    const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const chunkTo = (monthEnd < end ? monthEnd : end).toISOString().slice(0, 10);
    chunks.push({ from: chunkFrom, to: chunkTo });
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return chunks;
}

async function fetchAllIssuesForRange(client: AxiosInstance, from: string, to: string): Promise<any[]> {
  const PAGE_SIZE = 100;
  const issues: any[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    try {
      const body: Record<string, any> = {
        jql: `worklogDate >= "${from}" AND worklogDate <= "${to}"`,
        fields: ['summary', 'components', 'parent', 'issuetype', 'priority', 'customfield_10020'],
        maxResults: PAGE_SIZE,
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;

      const res = await client.post('/rest/api/3/search/jql', body);
      const page: any[] = res.data?.issues ?? [];
      issues.push(...page);
      nextPageToken = res.data?.nextPageToken ?? undefined;
      if (page.length === 0 || !nextPageToken) break;
    } catch (err: any) {
      logger.error('Jira search selhal', {
        status: err.response?.status,
        body: JSON.stringify(err.response?.data).slice(0, 500),
        from, to,
      });
      throw err;
    }
  }
  return issues;
}

async function resolveEpic(
  client: AxiosInstance,
  parentKey: string,
  cache: Map<string, { key: string; summary: string } | null>
): Promise<{ key: string; summary: string } | null> {
  if (cache.has(parentKey)) return cache.get(parentKey)!;
  try {
    const res = await client.get(`/rest/api/3/issue/${parentKey}`, {
      params: { fields: 'parent,issuetype,summary' },
    });
    const grandparent = res.data?.fields?.parent;
    const grandparentType = grandparent?.fields?.issuetype?.name ?? '';
    const result = grandparentType === 'Epic'
      ? { key: grandparent.key, summary: grandparent.fields?.summary ?? '' }
      : null;
    cache.set(parentKey, result);
    return result;
  } catch (err: any) {
    logger.warn('Nelze načíst grandparent issue', { parentKey, err: err.message });
    cache.set(parentKey, null);
    return null;
  }
}

async function fetchAllWorklogsForIssue(client: AxiosInstance, issueKey: string): Promise<any[]> {
  const PAGE_SIZE = 5000;
  const worklogs: any[] = [];
  let startAt = 0;

  while (true) {
    try {
      const res = await client.get(`/rest/api/3/issue/${issueKey}/worklog`, {
        params: { startAt, maxResults: PAGE_SIZE },
      });
      const page: any[] = res.data?.worklogs ?? [];
      const total: number = res.data?.total ?? 0;
      worklogs.push(...page);
      startAt += page.length;
      if (startAt >= total || page.length === 0) break;
    } catch (err: any) {
      logger.warn('Načítání worklogů selhalo', { issue: issueKey, status: err.response?.status });
      break;
    }
  }
  return worklogs;
}

function parseSprint(sprintField: any): string {
  if (!Array.isArray(sprintField) || sprintField.length === 0) return '';
  // Prefer active sprint, otherwise take the last one
  const active = sprintField.find((s: any) => s.state === 'active');
  const sprint = active ?? sprintField[sprintField.length - 1];
  return sprint?.name ?? '';
}

export async function fetchJiraWorklogs(from: string, to: string): Promise<JiraWorklogResponse[]> {
  if (USE_MOCK || !process.env.JIRA_API_TOKEN) {
    logger.info('Načítám mock Jira worklogy', { from, to });
    return generateMockWorklogs(from, to);
  }

  const baseUrl = process.env.JIRA_BASE_URL!.trim();
  const email = process.env.JIRA_EMAIL!.trim();
  const token = process.env.JIRA_API_TOKEN!.trim();
  const client = makeJiraClient(baseUrl, email, token);

  const chunks = splitIntoMonths(from, to);
  logger.info('Sync rozdělen do měsíčních chunků', { chunks: chunks.length, from, to });

  const seen = new Set<string>();
  const result: JiraWorklogResponse[] = [];
  const epicCache = new Map<string, { key: string; summary: string } | null>();

  for (const chunk of chunks) {
    logger.info('Zpracovávám chunk', { from: chunk.from, to: chunk.to });

    const issues = await fetchAllIssuesForRange(client, chunk.from, chunk.to);
    logger.info('Issues v chunku', { count: issues.length, month: chunk.from.slice(0, 7) });

    for (const issue of issues) {
      const worklogs = await fetchAllWorklogsForIssue(client, issue.key);

      const directParentKey: string = issue.fields?.parent?.key ?? '';
      const directParentSummary: string = issue.fields?.parent?.fields?.summary ?? '';
      const directParentType: string = issue.fields?.parent?.fields?.issuetype?.name ?? '';

      // Pokud přímý parent není Epic, dohledáme grandparent Epic
      let epicKey = directParentKey;
      let epicSummary = directParentSummary;
      let epicType = directParentType;

      if (directParentKey && directParentType && directParentType !== 'Epic') {
        const grandparent = await resolveEpic(client, directParentKey, epicCache);
        if (grandparent) {
          epicKey = grandparent.key;
          epicSummary = grandparent.summary;
          epicType = 'Epic';
        }
      }

      for (const w of worklogs) {
        const started = w.started?.slice(0, 10) ?? '';
        if (started < chunk.from || started > chunk.to) continue;
        if (seen.has(String(w.id))) continue;
        seen.add(String(w.id));

        result.push({
          worklogId: String(w.id),
          user: w.author?.displayName ?? 'unknown',
          accountId: w.author?.accountId ?? 'unknown',
          summary: issue.fields?.summary ?? '',
          parentKey: epicKey,
          parentSummary: epicSummary,
          parentIssueType: epicType,
          components: (issue.fields?.components ?? []).map((c: any) => c.name),
          sprint: parseSprint(issue.fields?.customfield_10020),
          issueType: issue.fields?.issuetype?.name ?? '',
          priority: issue.fields?.priority?.name ?? '',
          comment: w.comment?.content?.[0]?.content?.[0]?.text ?? '',
          seconds: w.timeSpentSeconds,
          started: w.started,
          issueKey: issue.key,
        });
      }
    }
  }

  logger.info('Jira worklogy načteny celkem', { count: result.length, chunks: chunks.length });
  return result;
}
