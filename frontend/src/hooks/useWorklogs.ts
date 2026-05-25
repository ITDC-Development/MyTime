import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { monthRange } from '../utils/dateUtils';
import { linearizeMonth, SourceWorklog } from '../utils/linearTime';
import type { RawWorklog, EditedWorklog, ManualWorklog, LinearWorklog } from '../types/worklog';

interface Args {
  accountIds: string[];
  year: number;
  month: number;
}

export function useWorklogs({ accountIds, year, month }: Args) {
  const [raw, setRaw] = useState<RawWorklog[]>([]);
  const [edited, setEdited] = useState<Record<string, EditedWorklog>>({});
  const [manual, setManual] = useState<ManualWorklog[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => monthRange(year, month), [year, month]);

  useEffect(() => {
    if (accountIds.length === 0) { setRaw([]); setLoading(false); return; }
    const q = query(
      collection(firestore, 'worklogs_raw'),
      where('accountId', 'in', accountIds),
      where('date', '>=', from),
      where('date', '<=', to)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRaw(snap.docs.map((d) => d.data() as RawWorklog));
      setLoading(false);
    });
    return unsub;
  }, [accountIds.join(','), from, to]);

  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, 'worklogs_edited'), (snap) => {
      const map: Record<string, EditedWorklog> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data() as EditedWorklog; });
      setEdited(map);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (accountIds.length === 0) { setManual([]); return; }
    const q = query(
      collection(firestore, 'manual_worklogs'),
      where('accountId', 'in', accountIds),
      where('date', '>=', from),
      where('date', '<=', to)
    );
    return onSnapshot(q, (snap) => {
      setManual(snap.docs.map((d) => d.data() as ManualWorklog));
    });
  }, [accountIds.join(','), from, to]);

  const linear: LinearWorklog[] = useMemo(() => {
    // Per uživatel a den linearizovat zvlášť, aby pauzy a přesčas seděly
    const byUser: Record<string, SourceWorklog[]> = {};
    for (const r of raw) {
      const e = edited[r.worklogId];
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
        components: e?.components ?? r.components,
        sprint: e?.sprint ?? r.sprint,
        comment: e?.comment ?? r.comment,
        isEdited: Boolean(e),
        isManual: false,
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
        components: m.components ?? [],
        sprint: m.sprint ?? '',
        comment: m.comment,
        isEdited: false,
        isManual: true,
      };
      (byUser[m.accountId] ||= []).push(merged);
    }
    return Object.values(byUser).flatMap(linearizeMonth);
  }, [raw, edited, manual]);

  return { raw, edited, manual, linear, loading };
}
