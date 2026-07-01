import { db } from './firestoreClient';
import { fetchJiraWorklogs, splitIntoMonths } from './jiraClient';
import { fetchAbsences, fetchMemberRoles, fetchTerminEvents, fetchDoctorVisitEvents, type MemberRole, type CustomTagMapping } from './activityTimelineClient';
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

// Smaže z worklogs_raw dokumenty, jejichž zdroj (Jira worklog / AT Termín / AT Lékař) v aktuálním
// syncu už neexistuje — tj. byl v Jira/Activity Timeline mezitím smazán nebo změněn.
// Kategorie, jejichž fetch v tomto běhu selhal, se do `categories` nepředávají, takže jejich
// dokumenty zůstanou nedotčené (jinak by prázdná množina validIds znamenala smazání všeho).
async function reconcileWorklogsRaw(
  from: string,
  to: string,
  categories: { name: string; predicate: (data: any) => boolean; validIds: Set<string> }[]
): Promise<{ deleted: number; skippedLocked: number; byCategory: Record<string, number> }> {
  if (categories.length === 0) return { deleted: 0, skippedLocked: 0, byCategory: {} };

  const snap = await db().collection('worklogs_raw')
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get();

  const toDelete: FirebaseFirestore.DocumentReference[] = [];
  const byCategory: Record<string, number> = {};
  let skippedLocked = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const category = categories.find(c => c.predicate(data));
    if (!category || category.validIds.has(doc.id)) continue;

    const d = new Date(data.date);
    if (await isLocked(d.getUTCFullYear(), d.getUTCMonth() + 1, data.accountId)) {
      skippedLocked++;
      continue;
    }
    toDelete.push(doc.ref);
    byCategory[category.name] = (byCategory[category.name] ?? 0) + 1;
  }

  for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const ref of toDelete.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
  if (toDelete.length > 0) {
    await deleteEditedWorklogs(toDelete.map(r => r.id));
  }

  return { deleted: toDelete.length, skippedLocked, byCategory };
}

// Totéž pro absence — kolekce obsahuje jen absence, takže není potřeba rozlišovat kategorie.
async function reconcileAbsences(
  from: string,
  to: string,
  validIds: Set<string>
): Promise<{ deleted: number; skippedLocked: number }> {
  const snap = await db().collection('absences')
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get();

  const toDelete: FirebaseFirestore.DocumentReference[] = [];
  let skippedLocked = 0;

  for (const doc of snap.docs) {
    if (validIds.has(doc.id)) continue;
    const data = doc.data() as Absence;
    const d = new Date(data.date);
    if (await isLocked(d.getUTCFullYear(), d.getUTCMonth() + 1, data.accountId)) {
      skippedLocked++;
      continue;
    }
    toDelete.push(doc.ref);
  }

  for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
    const batch = db().batch();
    for (const ref of toDelete.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }

  return { deleted: toDelete.length, skippedLocked };
}

export async function syncWorklogs(opts: { from: string; to: string; mode: 'incremental' | 'override' }) {
  const startTime = new Date().toISOString();
  const monthChunks = splitIntoMonths(opts.from, opts.to);
  logger.info('Sync rozdělen do měsíčních chunků', { count: monthChunks.length, from: opts.from, to: opts.to });

  let totalWritten = 0;
  let totalSkipped = 0;
  const allValidJiraIds = new Set<string>();

  for (const chunk of monthChunks) {
    logger.info('Zpracovávám chunk', chunk);
    const jiraData = await fetchJiraWorklogs(chunk.from, chunk.to);

    const docs: { ref: FirebaseFirestore.DocumentReference; data: RawWorklog }[] = [];

    for (const w of jiraData) {
      allValidJiraIds.add(String(w.worklogId));
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
  let absencesFetchOk = false;
  const validAbsenceIds = new Set<string>();
  try {
    const absences = await fetchAbsences(opts.from, opts.to, prefetchedMemberRoles);
    absencesFetchOk = true;
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
        validAbsenceIds.add(`${a.id}_${dayIndex}`);
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
  let terminFetchOk = false;
  const validTerminIds = new Set<string>();
  try {
    const tagDefsSnap = await db().collection('tag_definitions').get();
    const customMappings: CustomTagMapping[] = tagDefsSnap.docs.map(d => ({
      tagName: d.data().tagName as string,
      column: d.data().column as CustomTagMapping['column'],
    }));
    const terminEvents = await fetchTerminEvents(opts.from, opts.to, customMappings);
    terminFetchOk = true;
    const terminDocs: { ref: FirebaseFirestore.DocumentReference; data: any }[] = [];

    for (const t of terminEvents) {
      validTerminIds.add(t.worklogId);
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

  // Návštěvy lékaře z Activity Timeline → worklogs_raw (počítají se do odpracovaných hodin)
  let lekarWritten = 0;
  let lekarSkipped = 0;
  let lekarFetchOk = false;
  const validLekarIds = new Set<string>();
  try {
    const lekarEvents = await fetchDoctorVisitEvents(opts.from, opts.to);
    lekarFetchOk = true;
    const lekarDocs: { ref: FirebaseFirestore.DocumentReference; data: any }[] = [];

    for (const l of lekarEvents) {
      validLekarIds.add(l.worklogId);
      const d = new Date(l.date);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;

      if (await isLocked(year, month, l.accountId)) {
        lekarSkipped++;
        continue;
      }

      // Stejně jako Termíny vždy přepisujeme — datum/hodiny se v AT může měnit
      const ref = db().collection('worklogs_raw').doc(l.worklogId);
      lekarDocs.push({ ref, data: l });
    }

    lekarWritten = await commitInChunks(lekarDocs);
    if (opts.mode === 'override' && lekarDocs.length > 0) {
      await deleteEditedWorklogs(lekarDocs.map(d => d.data.worklogId));
    }
    logger.info('Lékař události zapsány', { written: lekarWritten, skipped: lekarSkipped });
  } catch (err: any) {
    logger.warn('Sync návštěv lékaře selhal (nekritická chyba)', { err: String(err) });
  }

  // Reconciliace — smazat worklogy/absence, jejichž zdroj v Jira/AT už neexistuje.
  // Kategorie, jejichž fetch výše selhal, se do reconciliace nezahrnou (jinak by prázdná
  // množina validIds znamenala smazání všech existujících záznamů té kategorie).
  let worklogsReconciled = 0;
  let worklogsReconciledSkippedLocked = 0;
  try {
    const categories: { name: string; predicate: (data: any) => boolean; validIds: Set<string> }[] = [
      { name: 'jira', predicate: (d) => !d.source, validIds: allValidJiraIds },
    ];
    if (terminFetchOk) categories.push({ name: 'termin', predicate: (d) => d.issueType === 'TERMIN', validIds: validTerminIds });
    if (lekarFetchOk) categories.push({ name: 'lekar', predicate: (d) => d.issueType === 'LEKAR', validIds: validLekarIds });

    const r = await reconcileWorklogsRaw(opts.from, opts.to, categories);
    worklogsReconciled = r.deleted;
    worklogsReconciledSkippedLocked = r.skippedLocked;
    logger.info('Reconciliace worklogs_raw dokončena', r);
  } catch (err: any) {
    logger.warn('Reconciliace worklogs_raw selhala (nekritická chyba)', { err: String(err) });
  }

  let absencesReconciled = 0;
  let absencesReconciledSkippedLocked = 0;
  if (absencesFetchOk) {
    try {
      const r = await reconcileAbsences(opts.from, opts.to, validAbsenceIds);
      absencesReconciled = r.deleted;
      absencesReconciledSkippedLocked = r.skippedLocked;
      logger.info('Reconciliace absencí dokončena', r);
    } catch (err: any) {
      logger.warn('Reconciliace absencí selhala (nekritická chyba)', { err: String(err) });
    }
  } else {
    logger.warn('Reconciliace absencí přeskočena — fetch absencí selhal');
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
    lekarWritten,
    worklogsReconciled,
    worklogsReconciledSkippedLocked,
    absencesReconciled,
    absencesReconciledSkippedLocked,
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
