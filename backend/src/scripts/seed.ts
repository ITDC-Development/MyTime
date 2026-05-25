import 'dotenv/config';
import { db, authAdmin } from '../services/firestoreClient';
import { syncWorklogs } from '../services/worklogService';
import { logger } from '../utils/logger';

interface SeedUser {
  email: string;
  password: string;
  displayName: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'blocked';
  jiraAccountId?: string;
}

const SEED_USERS: SeedUser[] = [
  { email: 'admin@it-dc.cz', password: 'admin1234', displayName: 'IT-DC Admin', role: 'admin', status: 'active' },
  { email: 'tomas.kraus@it-dc.cz', password: 'user1234', displayName: 'Tomáš Kraus', role: 'user', status: 'active', jiraAccountId: 'acc-tomas' },
  { email: 'hana.nova@it-dc.cz', password: 'user1234', displayName: 'Hana Nová', role: 'user', status: 'pending', jiraAccountId: 'acc-hana' },
  { email: 'pavel.dvorak@it-dc.cz', password: 'user1234', displayName: 'Pavel Dvořák', role: 'user', status: 'active', jiraAccountId: 'acc-pavel' },
];

async function ensureUser(u: SeedUser): Promise<string> {
  let uid: string;
  try {
    const existing = await authAdmin().getUserByEmail(u.email);
    uid = existing.uid;
  } catch {
    const created = await authAdmin().createUser({
      email: u.email, password: u.password, displayName: u.displayName,
    });
    uid = created.uid;
  }
  await db().collection('users').doc(uid).set({
    email: u.email.toLowerCase(),
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    jiraAccountId: u.jiraAccountId ?? null,
    createdAt: new Date().toISOString(),
    approvedAt: u.status === 'active' ? new Date().toISOString() : null,
    approvedBy: null,
    preferences: {
      showPauses: true,
      columns: {
        projectReport: ['date', 'period', 'issue', 'hours'],
        companyReport: ['date', 'period', 'issue', 'hours'],
        overview: ['user', 'date', 'period', 'issue', 'hours'],
      },
      lastSelectedUser: null,
    },
  }, { merge: false });
  logger.info('Seed user', { email: u.email, uid });
  return uid;
}

async function ensureSyncSettings() {
  await db().collection('sync_settings').doc('default').set({
    frequency: 'monthly',
    hour: 23,
    dayOfMonth: 1,
    period: 'previousMonth',
    updatedAt: new Date().toISOString(),
    updatedBy: 'seed',
  });
}

async function main() {
  for (const u of SEED_USERS) await ensureUser(u);
  await ensureSyncSettings();

  // Syncnout mock data pro květen 2026
  await syncWorklogs({ from: '2026-05-01', to: '2026-05-31', mode: 'override' });

  logger.info('Seed hotový. Přihlas se jako admin@it-dc.cz / admin1234');
  process.exit(0);
}

main().catch(err => {
  logger.error('Seed selhal', { err: String(err) });
  process.exit(1);
});
