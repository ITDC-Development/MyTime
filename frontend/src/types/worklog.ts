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
  date: string;
  issueType: string;
  priority: string;
}

export interface EditedWorklog {
  worklogId: string;
  user: string;
  accountId: string;
  summary?: string;
  issueKey?: string;
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

export interface LinearWorklog {
  worklogId: string;
  accountId: string;
  user: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  hours: number;
  summary: string;
  issueKey: string;
  parentKey: string;
  parentSummary: string;
  parentIssueType: string;
  components: string[];
  sprint: string;
  comment: string;
  isOvertime: boolean;
  isPause: boolean;
  isEdited: boolean;
  isManual: boolean;
  issueType: string;
  priority: string;
}
