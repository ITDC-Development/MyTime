export interface RawWorklog {
  worklogId: string;
  user: string;
  accountId: string;
  summary: string;
  parentKey: string;
  parentSummary: string;
  parentIssueType: string;
  components: string[];
  sprint: string;
  comment: string;
  seconds: number;
  started: string;
  issueKey: string;
  date: string; // YYYY-MM-DD pro indexaci
  issueType: string;
  priority: string;
  source?: 'jira' | 'activity_timeline';
}

export interface EditedWorklog {
  worklogId: string;
  user: string;
  accountId: string;
  summary?: string;
  parentKey?: string;
  parentSummary?: string;
  components?: string[];
  sprint?: string;
  comment?: string;
  seconds?: number;
  date?: string;
  editedAt: string;
  editedBy: string;
}

export interface ManualWorklog {
  id: string;
  user: string;
  accountId: string;
  summary: string;
  date: string;
  seconds: number;
  comment: string;
  parentKey?: string;
  parentSummary?: string;
  components?: string[];
  sprint?: string;
  createdAt: string;
  createdBy: string;
}

export interface Absence {
  id: string;
  user: string;
  accountId: string;
  type: 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY';
  date: string;
  hours: number;
}

export interface Lock {
  year: number;
  month: number;
  accountId: string;
  lockedAt: string;
  lockedBy: string;
}

export interface SyncSettings {
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  dayOfWeek?: number;  // 0-6 (neděle-sobota)
  dayOfMonth?: number; // 1-31
  period: 'currentMonth' | 'previousMonth';
  updatedAt: string;
  updatedBy: string;
}
