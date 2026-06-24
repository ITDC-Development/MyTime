export type TagColumn = 'issueKey' | 'parentKey' | 'parentSummary' | 'components' | 'sprint' | 'comment' | 'summary';

export interface TagDefinition {
  id: string;
  tagName: string;
  column: TagColumn;
  createdAt: string;
  createdBy: string;
}

export const TAG_COLUMN_LABELS: Record<TagColumn, string> = {
  issueKey:      'Issue klíč',
  parentKey:     'Parent-klíč',
  parentSummary: 'Parent-název',
  components:    'Komponenta',
  sprint:        'Sprint',
  comment:       'Komentář',
  summary:       'Název',
};

export const TAG_COLUMN_OPTIONS: { value: TagColumn; label: string }[] = (
  Object.entries(TAG_COLUMN_LABELS) as [TagColumn, string][]
).map(([value, label]) => ({ value, label }));
