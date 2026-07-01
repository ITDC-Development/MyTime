import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { monthRange } from '../utils/dateUtils';
import { linearizeMonth, SourceWorklog } from '../utils/linearTime';
import type { RawWorklog, EditedWorklog, ManualWorklog, LinearWorklog } from '../types/worklog';
import type { Absence } from '../types/jira';

interface Args {
  accountIds: string[] | null; // null = fetch all (admin)
  year: number;
  month: number;
}

export function useWorklogs({ accountIds, year, month }: Args) {
  const [raw, setRaw] = useState<RawWorklog[]>([]);
  const [edited, setEdited] = useState<Record<string, EditedWorklog>>({});
  const [manual, setManual] = useState<ManualWorklog[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => monthRange(year, month), [year, month]);

  useEffect(() => {
    if (accountIds !== null && accountIds.length === 0) { setRaw([]); setLoading(false); return; }
    const q = accountIds === null
      ? query(collection(firestore, 'worklogs_raw'), where('date', '>=', from), where('date', '<=', to))
      : query(collection(firestore, 'worklogs_raw'), where('accountId', 'in', accountIds), where('date', '>=', from), where('date', '<=', to));
    const unsub = onSnapshot(q, (snap) => {
      setRaw(snap.docs.map((d) => d.data() as RawWorklog));
      setLoading(false);
    });
    return unsub;
  }, [accountIds === null ? 'ALL' : accountIds.join(','), from, to]);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'worklogs_edited'), (snap) => {
      const map: Record<string, EditedWorklog> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data() as EditedWorklog; });
      setEdited(map);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (accountIds !== null && accountIds.length === 0) { setManual([]); return; }
    const q = accountIds === null
      ? query(collection(firestore, 'manual_worklogs'), where('date', '>=', from), where('date', '<=', to))
      : query(collection(firestore, 'manual_worklogs'), where('accountId', 'in', accountIds), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(q, (snap) => {
      setManual(snap.docs.map((d) => d.data() as ManualWorklog));
    });
  }, [accountIds === null ? 'ALL' : accountIds.join(','), from, to]);

  useEffect(() => {
    if (accountIds !== null && accountIds.length === 0) { setAbsences([]); return; }
    const q = accountIds === null
      ? query(collection(firestore, 'absences'), where('date', '>=', from), where('date', '<=', to))
      : query(collection(firestore, 'absences'), where('accountId', 'in', accountIds), where('date', '>=', from), where('date', '<=', to));
    return onSnapshot(q, (snap) => {
      setAbsences(snap.docs.map((d) => d.data() as Absence));
    });
  }, [accountIds === null ? 'ALL' : accountIds.join(','), from, to]);

  // Dovolená/volno se počítá do 8h denního fondu, takže se promítá do přesčasu.
  const absenceHoursByUserDate = useMemo(() => {
    const byUser: Record<string, Record<string, number>> = {};
    for (const a of absences) {
      if (a.type !== 'VACATION' && a.type !== 'DAY_OFF') continue;
      const byDate = (byUser[a.accountId] ||= {});
      byDate[a.date] = (byDate[a.date] ?? 0) + a.hours;
    }
    return byUser;
  }, [absences]);

  const linear: LinearWorklog[] = useMemo(() => {
    // Per uživatel a den linearizovat zvlášť, aby pauzy a přesčas seděly
    const byUser: Record<string, SourceWorklog[]> = {};
    for (const r of raw) {
      const e = edited[r.worklogId];
      // Pro TERMIN záznamy starého syncu byl comment = celý AT title (začíná '[').
      // Takový comment ignorujeme — platný comment přichází pouze z [Komentar:] tagu nebo z editace.
      const rawComment = (r.issueType === 'TERMIN' && r.comment.startsWith('['))
        ? ''
        : r.comment;
      const merged: SourceWorklog = {
        worklogId: r.worklogId,
        accountId: r.accountId,
        user: r.user,
        date: e?.date ?? r.date,
        started: r.started,
        seconds: e?.seconds ?? r.seconds,
        summary: e?.summary ?? r.summary,
        issueKey: e?.issueKey ?? r.issueKey,
        parentKey: e?.parentKey ?? r.parentKey,
        parentSummary: e?.parentSummary ?? r.parentSummary,
        parentIssueType: r.parentIssueType ?? '',
        components: e?.components ?? r.components,
        sprint: e?.sprint ?? r.sprint,
        comment: e?.comment ?? rawComment,
        isEdited: Boolean(e),
        isManual: false,
        issueType: r.issueType ?? '',
        priority: r.priority ?? '',
      };
      (byUser[r.accountId] ||= []).push(merged);
    }
    for (const m of manual) {
      const merged: SourceWorklog = {
        worklogId: m.id,
        accountId: m.accountId,
        user: m.user,
        date: m.date,
        started: `${m.date}T00:00:00.000Z`,
        seconds: m.seconds,
        summary: m.summary,
        issueKey: '',
        parentKey: m.parentKey ?? '',
        parentSummary: m.parentSummary ?? '',
        parentIssueType: '',
        components: m.components ?? [],
        sprint: m.sprint ?? '',
        comment: m.comment,
        isEdited: false,
        isManual: true,
        issueType: '',
        priority: '',
      };
      (byUser[m.accountId] ||= []).push(merged);
    }
    return Object.entries(byUser).flatMap(([accountId, items]) =>
      linearizeMonth(items, absenceHoursByUserDate[accountId] ?? {})
    );
  }, [raw, edited, manual, absenceHoursByUserDate]);

  return { raw, edited, manual, absences, linear, loading };
}
