export interface JiraWorklogResponse {
  worklogId: string | number;
  user: string;
  accountId: string;
  summary: string;
  parentKey?: string;
  parentSummary?: string;
  components?: string[];
  sprint?: string;
  comment?: string;
  seconds: number;
  started: string;
  issueKey: string;
}

export interface ActivityTimelineEvent {
  id: string | number;
  username: string;
  accountId: string;
  type: 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY' | 'BOOKING' | 'PLACEHOLDER';
  start: string;
  end: string;
  hours?: number;
}
