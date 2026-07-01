import type { RawWorklog, EditedWorklog, ManualWorklog } from '../types/worklog';

export interface LinearWorklog {
  worklogId: string;
  accountId: string;
  user: string;
  date: string;
  startMinutes: number;   // od půlnoci
  endMinutes: number;
  hours: number;
  summary: string;
  issueKey: string;
  parentKey: string;
  parentSummary: string;
  components: string[];
  sprint: string;
  comment: string;
  isOvertime: boolean;
  isPause: boolean;
  isEdited: boolean;
  isManual: boolean;
}

const WORK_START = 8 * 60;       // 08:00
const WORK_END = 16 * 60 + 30;   // 16:30
const PAUSE_START = 12 * 60;     // 12:00
const PAUSE_END = 12 * 60 + 30;  // 12:30
const OVERTIME_THRESHOLD_MINUTES = 8 * 60; // 8h denně

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatRange(startMin: number, endMin: number): string {
  return `${minutesToHHMM(startMin)}–${minutesToHHMM(endMin)}`;
}

interface InputWorklog {
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
  components: string[];
  sprint: string;
  comment: string;
  isEdited: boolean;
  isManual: boolean;
}

export function linearizeDay(items: InputWorklog[], priorMinutesToday: number = 0): LinearWorklog[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) =>
    a.started.localeCompare(b.started) || a.worklogId.localeCompare(b.worklogId)
  );
  const out: LinearWorklog[] = [];
  let cursor = WORK_START;
  let pauseInserted = false;
  let workedMinutesToday = priorMinutesToday;

  for (const w of sorted) {
    let remaining = Math.round(w.seconds / 60);
    while (remaining > 0) {
      // Pauza
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
          issueKey: '',
          parentKey: '',
          parentSummary: '',
          components: [],
          sprint: '',
          comment: '',
          isOvertime: false,
          isPause: true,
          isEdited: false,
          isManual: false,
        });
        cursor = PAUSE_END;
      }
      // Pokud se segment dotýká pauzy, useknout
      let segmentEnd = cursor + remaining;
      if (!pauseInserted && cursor < PAUSE_START && segmentEnd > PAUSE_START) {
        segmentEnd = PAUSE_START;
      }
      if (workedMinutesToday < OVERTIME_THRESHOLD_MINUTES && workedMinutesToday + (segmentEnd - cursor) > OVERTIME_THRESHOLD_MINUTES) {
        segmentEnd = cursor + (OVERTIME_THRESHOLD_MINUTES - workedMinutesToday);
      }
      const segmentMinutes = segmentEnd - cursor;
      const isOvertime = workedMinutesToday >= OVERTIME_THRESHOLD_MINUTES;

      out.push({
        worklogId: w.worklogId,
        accountId: w.accountId,
        user: w.user,
        date: w.date,
        startMinutes: cursor,
        endMinutes: segmentEnd,
        hours: segmentMinutes / 60,
        summary: w.summary,
        issueKey: w.issueKey,
        parentKey: w.parentKey,
        parentSummary: w.parentSummary,
        components: w.components,
        sprint: w.sprint,
        comment: w.comment,
        isOvertime,
        isPause: false,
        isEdited: w.isEdited,
        isManual: w.isManual,
      });

      workedMinutesToday += segmentMinutes;
      cursor = segmentEnd;
      remaining -= segmentMinutes;

      if (cursor === PAUSE_START && !pauseInserted) {
        pauseInserted = true;
      }
    }
  }
  return out;
}

export function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.date] ||= []).push(item);
    return acc;
  }, {});
}
