import { db } from './firestoreClient';
import { fetchJiraWorklogs, splitIntoMonths } from './jiraClient';
import { fetchAbsences, fetchMemberRoles, fetchTerminEvents, type MemberRole } from './activityTimelineClient';
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
          parentIssueType: w.parentIssueType ?? '',
          components: w.components ?? [],
          sprint: w.sprint ?? '',
          comment: w.comment ?? '',
          seconds: w.seconds,
          started: w.started,
          issueKey: w.issueKey,
          date,
          issueType: w.issueType ?? '',
          priority: w.priority ?? '',
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

  // Fetch member roles first — needed to filter HOLIDAY absences by correct country
  let prefetchedMemberRoles: MemberRole[] = [];
  try {
    const year = new Date().getUTCFullYear();
    prefetchedMemberRoles = await fetchMemberRoles(`${year}-01-01`, `${year}-12-31`);
  } catch (err: any) {
    logger.warn('Pre-fetch member roles selhal — absence se mohou zapsat bez filtrování HOLIDAY', { err: String(err) });
  }

  // Absences
  let absWritten = 0;
  let atError: string | null = null;
  try {
    const absences = await fetchAbsences(opts.from, opts.to, prefetchedMemberRoles);
    const absDocs: { ref: FirebaseFirestore.DocumentReference; data: Absence }[] = [];

    for (const a of absences) {
      const start = new Date(a.start + 'T00:00:00Z');
      const end = new Date((a.end ?? a.start) + 'T00:00:00Z');
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
      const hoursPerDay = a.hoursPerDay != null
        ? a.hoursPerDay
        : a.hours != null
          ? a.hours / totalDays
          : 8;
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
            hours: hoursPerDay,
          },
        });
        dayIndex++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    // V incremental módu přeskočit již existující absence (stejně jako worklogy)
    let docsToWrite = absDocs;
    if (opts.mode === 'incremental' && absDocs.length > 0) {
      const GETALL_LIMIT = 500;
      const existingIds = new Set<string>();
      for (let i = 0; i < absDocs.length; i += GETALL_LIMIT) {
        const refs = absDocs.slice(i, i + GETALL_LIMIT).map(d => d.ref);
        const snaps = await db().getAll(...refs);
        for (const snap of snaps) {
          if (snap.exists) existingIds.add(snap.id);
        }
      }
      docsToWrite = absDocs.filter(d => !existingIds.has(d.ref.id));
      logger.info('Absence incremental — přeskočeny existující', {
        total: absDocs.length,
        skipped: existingIds.size,
        toWrite: docsToWrite.length,
      });
    }

    absWritten = await commitInChunks(docsToWrite);
  } catch (err: any) {
    atError = err?.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).slice(0, 300)}`
      : String(err);
    logger.error('Activity Timeline selhalo', { atError, from: opts.from, to: opts.to });
  }

  // Termíny z Activity Timeline → worklogs_raw
  let terminWritten = 0;
  let terminSkipped = 0;
  try {
    const terminEvents = await fetchTerminEvents(opts.from, opts.to);
    const terminDocs: { ref: FirebaseFirestore.DocumentReference; data: any }[] = [];

    for (const t of terminEvents) {
      const d = new Date(t.date);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;

      if (await isLocked(year, month, t.accountId)) {
        terminSkipped++;
        continue;
      }

      // Termíny vždy přepisujeme — datum/čas se v AT může měnit
      const ref = db().collection('worklogs_raw').doc(t.worklogId);
      terminDocs.push({ ref, data: t });
    }

    terminWritten = await commitInChunks(terminDocs);
    if (opts.mode === 'override' && terminDocs.length > 0) {
      await deleteEditedWorklogs(terminDocs.map(d => d.data.worklogId));
    }
    logger.info('Termíny zapsány', { written: terminWritten, skipped: terminSkipped });
  } catch (err: any) {
    logger.warn('Sync termínů selhal (nekritická chyba)', { err: String(err) });
  }

  // Sync členů a rolí z AT (nekritická — chyba neblokuje výsledek syncu)
  let rolesUpdated = 0;
  try {
    const memberRoles = prefetchedMemberRoles.length > 0
      ? prefetchedMemberRoles
      : await fetchMemberRoles(`${new Date().getUTCFullYear()}-01-01`, `${new Date().getUTCFullYear()}-12-31`);

    // Uložit všechny AT členy do kolekce members (accountId jako ID dokumentu)
    for (let i = 0; i < memberRoles.length; i += BATCH_LIMIT) {
      const batch = db().batch();
      for (const { accountId, displayName, role, country } of memberRoles.slice(i, i + BATCH_LIMIT)) {
        const data: Record<string, any> = { accountId, displayName, role };
        if (country) data.country = country;
        batch.set(db().collection('members').doc(accountId), data, { merge: true });
      }
      await batch.commit();
    }

    // Aktualizovat roli u uživatelů s app účtem
    const usersSnap = await db().collection('users').where('role', 'in', ['user', 'freelancer']).get();
    const accountIdToUid = new Map<string, string>();
    for (const doc of usersSnap.docs) {
      const jiraId = doc.data().jiraAccountId as string | null;
      if (jiraId) accountIdToUid.set(jiraId, doc.id);
    }
    if (accountIdToUid.size > 0) {
      const batch = db().batch();
      for (const { accountId, role } of memberRoles) {
        const uid = accountIdToUid.get(accountId);
        if (uid) { batch.update(db().collection('users').doc(uid), { role }); rolesUpdated++; }
      }
      if (rolesUpdated > 0) await batch.commit();
    }
    logger.info('AT členové synchronizováni', { total: memberRoles.length, rolesUpdated });
  } catch (err: any) {
    logger.warn('Sync členů z AT selhal (nekritická chyba)', { err: String(err) });
  }

  const finishTime = new Date().toISOString();
  const result: Record<string, any> = {
    startedAt: startTime,
    finishedAt: finishTime,
    worklogsWritten: totalWritten,
    worklogsSkipped: totalSkipped,
    absencesWritten: absWritten,
    terminWritten,
    rolesUpdated,
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
