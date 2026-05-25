import { collection, doc, getDocs, query, setDoc, where, addDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { EditedWorklog, ManualWorklog } from '../../types/worklog';

export async function saveEditedWorklog(w: EditedWorklog) {
  await setDoc(doc(firestore, 'worklogs_edited', w.worklogId), w);
}

export async function deleteEditedWorklog(worklogId: string) {
  await deleteDoc(doc(firestore, 'worklogs_edited', worklogId));
}

export async function addManualWorklog(w: Omit<ManualWorklog, 'id'>) {
  const ref = await addDoc(collection(firestore, 'manual_worklogs'), w);
  await setDoc(ref, { ...w, id: ref.id });
  return ref.id;
}

export async function deleteManualWorklog(id: string) {
  await deleteDoc(doc(firestore, 'manual_worklogs', id));
}
