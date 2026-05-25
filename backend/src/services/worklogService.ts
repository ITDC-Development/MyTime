import { db } from './firestoreClient';
import { fetchJiraWorklogs } from './jiraClient';
import { fetchAbsences } from './activityTimelineClient';
import { isLocked } from './lockService';
import { logger } from '../utils/logger';
import type { RawWorklog, Absence } from '../types/worklog';

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export async function syncWorklogs(opts: { from: string; to: string; mode: 'incremental' | 'override' }) {
  const startTime = new Date().toISOString();
  const jiraData = await fetchJiraWorklogs(opts.from, opts.to);
  const batch = db().batch();
  let written = 0;
  let skipped = 0;

  for (const w of jiraData) {
    const date = dateOnly(w.started);
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    // Skip locked
    if (await isLocked(year, month, w.accountId)) {
      skipped++;
      continue;
    }

    const ref = db().collection('worklogs_raw').doc(String(w.worklogId));
    if (opts.mode === 'incremental') {
      const existing = await ref.get();
      if (existing.exists) {
        skipped++;
        continue;
      }
    }
    const raw: RawWorklog = {
      worklogId: String(w.worklogId),
      user: w.user,
      accountId: w.accountId,
      summary: w.summary,
      parentKey: w.parentKey ?? '',
      parentSummary: w.parentSummary ?? '',
      components: w.components ?? [],
      sprint: w.sprint ?? '',
      comment: w.comment ?? '',
      seconds: w.seconds,
      started: w.started,
      issueKey: w.issueKey,
      date,
    };
    batch.set(ref, raw);
    written++;
  }
  await batch.commit();

  // Absences — expand multi-day entries into one document per calendar day
  const absences = await fetchAbsences(opts.from, opts.to);
  const absBatch = db().batch();
  let absWritten = 0;
  for (const a of absences) {
    const start = new Date(a.start);
    const end = new Date(a.end ?? a.start);
    const cur = new Date(start);
    let dayIndex = 0;
    while (cur <= end) {
      const dayStr = cur.toISOString().slice(0, 10);
      const ref = db().collection('absences').doc(`${a.id}_${dayIndex}`);
      const absence: Absence = {
        id: `${a.id}_${dayIndex}`,
        user: a.username,
        accountId: a.accountId,
        type: a.type as Absence['type'],
        date: dayStr,
        hours: 8,
      };
      absBatch.set(ref, absence);
      absWritten++;
      dayIndex++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  await absBatch.commit();

  const finishTime = new Date().toISOString();
  const result = {
    startedAt: startTime,
    finishedAt: finishTime,
    worklogsWritten: written,
    worklogsSkipped: skipped,
    absencesWritten: absWritten,
    range: { from: opts.from, to: opts.to },
    mode: opts.mode,
  };
  await db().collection('sync_log').add(result);
  logger.info('Sync hotový', result);
  return result;
}

export function periodForSettings(period: 'currentMonth' | 'previousMonth', now = new Date()): { from: string; to: string } {
  const d = new Date(now);
  if (period === 'previousMonth') {
    d.setMonth(d.getMonth() - 1);
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}
