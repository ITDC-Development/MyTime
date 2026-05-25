import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { firestore } from '../firebase';

export interface SyncLogEntry {
  startedAt: string;
  finishedAt: string;
  worklogsWritten: number;
  worklogsSkipped: number;
  absencesWritten: number;
  range: { from: string; to: string };
  mode: string;
}
