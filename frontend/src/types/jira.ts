export interface Absence {
  id: string;
  user: string;
  accountId: string;
  type: 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY';
  date: string;
  hours: number;
}
