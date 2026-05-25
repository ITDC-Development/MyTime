import axios from 'axios';
import { logger } from '../utils/logger';
import type { JiraWorklogResponse } from '../types/jira';

const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

// Mock data pro vývoj bez Jira přístupu
function generateMockWorklogs(from: string, to: string): JiraWorklogResponse[] {
  const start = new Date(from);
  const end = new Date(to);
  const employees = [
    { user: 'Tomáš Kraus', accountId: 'acc-tomas' },
    { user: 'Hana Nová', accountId: 'acc-hana' },
    { user: 'Pavel Dvořák', accountId: 'acc-pavel' },
  ];
  const issues = [
    { key: 'ENBW-2125', summary: 'Push-Jobs einplanen', parentKey: 'ENBW-35', parent: 'PM :: MOPO', components: ['SAP PM Custom Code'] },
    { key: 'ENBW-2108', summary: 'Review change requests', parentKey: 'ENBW-35', parent: 'PM :: MOPO', components: ['SAP PM Custom Code'] },
    { key: 'ENBW-2110', summary: 'Implementace endpointu', parentKey: 'ENBW-35', parent: 'PM :: MOPO', components: ['SAP PM Custom Code'] },
  ];

  const result: JiraWorklogResponse[] = [];
  let wid = 1000;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue; // víkend přeskočit
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

export async function fetchJiraWorklogs(from: string, to: string): Promise<JiraWorklogResponse[]> {
  if (USE_MOCK || !process.env.JIRA_API_TOKEN) {
    logger.info('Načítám mock Jira worklogy', { from, to });
    return generateMockWorklogs(from, to);
  }

  const baseUrl = process.env.JIRA_BASE_URL!;
  const email = process.env.JIRA_EMAIL!;
  const token = process.env.JIRA_API_TOKEN!;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  // Reálné volání Jira REST API
  // Pozn.: tohle je zjednodušená integrace, produkčně by se použila JQL search
  // a paginace přes /rest/api/3/search/worklog s expanded fields.
  const url = `${baseUrl}/rest/api/3/search?jql=worklogDate >= "${from}" AND worklogDate <= "${to}"&fields=worklog,summary,components,parent,sprint`;
  const response = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });

  // Transformace - real-world by mapovala issue.fields.worklog.worklogs[]
  // Tady jen placeholder, který by se v produkci doplnil podle skutečné struktury
  const issues = (response.data?.issues ?? []) as any[];
  const result: JiraWorklogResponse[] = [];
  for (const issue of issues) {
    const worklogs = issue.fields?.worklog?.worklogs ?? [];
    for (const w of worklogs) {
      result.push({
        worklogId: String(w.id),
        user: w.author?.displayName ?? 'unknown',
        accountId: w.author?.accountId ?? 'unknown',
        summary: issue.fields?.summary ?? '',
        parentKey: issue.fields?.parent?.key ?? '',
        parentSummary: issue.fields?.parent?.fields?.summary ?? '',
        components: (issue.fields?.components ?? []).map((c: any) => c.name),
        sprint: issue.fields?.sprint?.name ?? '',
        comment: w.comment?.content?.[0]?.content?.[0]?.text ?? '',
        seconds: w.timeSpentSeconds,
        started: w.started,
        issueKey: issue.key,
      });
    }
  }
  return result;
}
