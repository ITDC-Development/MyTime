import type { LinearWorklog } from '../types/worklog';
export function filterPauses(items: LinearWorklog[], showPauses: boolean): LinearWorklog[] {
  return showPauses ? items : items.filter(i => !i.isPause);
}
