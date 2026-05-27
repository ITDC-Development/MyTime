import { db } from './firestoreClient';
import { fetchJiraWorklogs, splitIntoMonths } from './jiraClient';
import { fetchAbsences } from './activityTimelineClient';
import { isLocked } from './lockService';
import { logger } from '../utils/logger';
import type { RawWorklog, Absence } from '../types/worklog';

const BATCH_LIMIT = 499;

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

async function commitInChunks(items: { ref: FirebaseFirestore.DocumentReference; data: any }[]): Promise<number> {
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const { ref, data } of items.slice(i, i + BATCH_LIMIT)) {
      batch.set(ref, data);
    }
    await batch.commit();
  }
  return items.length;
}

async function deleteEditedWorklogs(worklogIds: string[]): Promise<void> {
  for (let i = 0; i < worklogIds.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const id of worklogIds.slice(i, i + BATCH_LIMIT)) {
      batch.delete(db().collection('worklogs_edited').doc(id));
    }
    await batch.commit();
  }
}

export async function syncWorklogs(opts: { from: string; to: string; mode: 'incremental' | 'override' }) {
  const startTime = new Date().toISOString();
  const monthChunks = splitIntoMonths(opts.from, opts.to);
  logger.info('Sync rozdělen do měsíčních chunků', { count: monthChunks.length, from: opts.from, to: opts.to });

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const chunk of monthChunks) {
    logger.info('Zpracovávám chunk', chunk);
    const jiraData = await fetchJiraWorklogs(chunk.from, chunk.to);

    const docs: { ref: FirebaseFirestore.DocumentReference; data: RawWorklog }[] = [];

    for (const w of jiraData) {
      const date = dateOnly(w.started);
      const d = new Date(date);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;

      if (await isLocked(year, month, w.accountId)) {
        totalSkipped++;
        continue;
      }

      const ref = db().collection('worklogs_raw').doc(String(w.worklogId));
      if (opts.mode === 'incremental') {
        const existing = await ref.get();
        if (existing.exists) {
          totalSkipped++;
          continue;
        }
      }

      docs.push({
        ref,
        data: {
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
        },
      });
    }

    const written = await commitInChunks(docs);
    totalWritten += written;

    if (opts.mode === 'override' && docs.length > 0) {
      await deleteEditedWorklogs(docs.map(d => d.data.worklogId));
    }

    logger.info('Chunk zapsán', { chunk, written });
  }

  // Absences
  let absWritten = 0;
  let atError: string | null = null;
  try {
    const absences = await fetchAbsences(opts.from, opts.to);
    const absDocs: { ref: FirebaseFirestore.DocumentReference; data: Absence }[] = [];

    for (const a of absences) {
      const start = new Date(a.start);
      const end = new Date(a.end ?? a.start);
      const cur = new Date(start);
      let dayIndex = 0;
      while (cur <= end) {
        const dayStr = cur.toISOString().slice(0, 10);
        absDocs.push({
          ref: db().collection('absences').doc(`${a.id}_${dayIndex}`),
          data: {
            id: `${a.id}_${dayIndex}`,
            user: a.username,
            accountId: a.accountId,
            type: a.type as Absence['type'],
            date: dayStr,
            hours: 8,
          },
        });
        dayIndex++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    // Diagnostika — unikátní accountId uložených absencí
    const uniqueAccounts = [...new Set(absDocs.map(d => `${d.data.user} → ${d.data.accountId} (${d.data.type})`))];
    logger.info('Absence accountIds ukládané do Firestore', { uniqueAccounts });
    absWritten = await commitInChunks(absDocs);
  } catch (err: any) {
    atError = err?.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 300)}`
      : String(err);
    logger.error('Activity Timeline selhalo', { atError, from: opts.from, to: opts.to });
  }

  const finishTime = new Date().toISOString();
  const result: Record<string, any> = {
    startedAt: startTime,
    finishedAt: finishTime,
    worklogsWritten: totalWritten,
    worklogsSkipped: totalSkipped,
    absencesWritten: absWritten,
    range: { from: opts.from, to: opts.to },
    mode: opts.mode,
    ...(atError ? { atError } : {}),
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
