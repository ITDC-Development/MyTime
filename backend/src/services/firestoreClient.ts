import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

let initialized = false;

export function initFirebase() {
  if (initialized) return;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'demo-mytime';

  // V emulátoru se používají FIRESTORE_EMULATOR_HOST a FIREBASE_AUTH_EMULATOR_HOST
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  initialized = true;
  logger.info('Firebase Admin SDK inicializován', { projectId });
}

export function db() {
  initFirebase();
  return admin.firestore();
}

export function authAdmin() {
  initFirebase();
  return admin.auth();
}
