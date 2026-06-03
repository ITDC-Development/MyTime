import type { LinearWorklog } from '../types/worklog';

const WORK_START = 8 * 60;
const PAUSE_START = 12 * 60;
const PAUSE_END = 12 * 60 + 30;
const OVERTIME_THRESHOLD = 8 * 60;

export interface SourceWorklog {
  worklogId: string;
  accountId: string;
  user: string;
  date: string;
  started: string;
  seconds: number;
  summary: string;
  issueKey: string;
  parentKey: string;
  parentSummary: string;
  parentIssueType: string;
  components: string[];
  sprint: string;
  comment: string;
  isEdited: boolean;
  isManual: boolean;
  issueType: string;
  priority: string;
}

export function linearizeDay(items: SourceWorklog[]): LinearWorklog[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort(
    (a, b) => a.started.localeCompare(b.started) || a.worklogId.localeCompare(b.worklogId)
  );
  const out: LinearWorklog[] = [];
  let cursor = WORK_START;
  let pauseInserted = false;
  let workedToday = 0;

  for (const w of sorted) {
    let remaining = Math.round(w.seconds / 60);
    while (remaining > 0) {
      if (!pauseInserted && cursor >= PAUSE_START) {
        out.push({
          worklogId: `pause-${w.date}`,
          accountId: w.accountId,
          user: w.user,
          date: w.date,
          startMinutes: PAUSE_START,
          endMinutes: PAUSE_END,
          hours: 0.5,
          summary: 'Pauza (oběd)',
          issueKey: '', parentKey: '', parentSummary: '', parentIssueType: '',
          components: [], sprint: '', comment: '',
          isOvertime: false, isPause: true, isEdited: false, isManual: false,
          issueType: '', priority: '',
        });
        cursor = PAUSE_END;
        pauseInserted = true;
      }
      let segmentEnd = cursor + remaining;
      if (!pauseInserted && cursor < PAUSE_START && segmentEnd > PAUSE_START) {
        segmentEnd = PAUSE_START;
      }
      const segMinutes = segmentEnd - cursor;
      const isOvertime = workedToday + segMinutes > OVERTIME_THRESHOLD;

      out.push({
        worklogId: w.worklogId,
        accountId: w.accountId,
        user: w.user,
        date: w.date,
        startMinutes: cursor,
        endMinutes: segmentEnd,
        hours: segMinutes / 60,
        summary: w.summary,
        issueKey: w.issueKey,
        parentKey: w.parentKey,
        parentSummary: w.parentSummary,
        parentIssueType: w.parentIssueType,
        components: w.components,
        sprint: w.sprint,
        comment: w.comment,
        isOvertime,
        isPause: false,
        isEdited: w.isEdited,
        isManual: w.isManual,
        issueType: w.issueType,
        priority: w.priority,
      });

      workedToday += segMinutes;
      cursor = segmentEnd;
      remaining -= segMinutes;
    }
  }
  return out;
}

export function linearizeMonth(items: SourceWorklog[]): LinearWorklog[] {
  const byDate: Record<string, SourceWorklog[]> = {};
  for (const w of items) (byDate[w.date] ||= []).push(w);
  return Object.keys(byDate).sort().flatMap(d => linearizeDay(byDate[d]));
}
