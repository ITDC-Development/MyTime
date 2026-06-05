import { CloudSchedulerClient } from '@google-cloud/scheduler';

const JOB_NAME = 'projects/mytime-497508/locations/europe-west1/jobs/mytime-sync';
const BACKEND_URL = 'https://mytime-backend-771716439181.europe-west1.run.app/sync/scheduled';
const SERVICE_ACCOUNT = '771716439181-compute@developer.gserviceaccount.com';

export interface SyncSettings {
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  period: 'currentMonth' | 'previousMonth';
}

function buildCron(s: SyncSettings): string {
  const m = s.minute;
  const h = s.hour;
  if (s.frequency === 'daily') return `${m} ${h} * * *`;
  if (s.frequency === 'weekly') return `${m} ${h} * * ${s.dayOfWeek}`;
  return `${m} ${h} ${s.dayOfMonth} * *`;
}

export async function updateSchedulerJob(settings: SyncSettings): Promise<void> {
  const client = new CloudSchedulerClient();
  await client.updateJob({
    job: {
      name: JOB_NAME,
      schedule: buildCron(settings),
      timeZone: 'Europe/Prague',
      httpTarget: {
        uri: BACKEND_URL,
        httpMethod: 'POST' as const,
        oidcToken: {
          serviceAccountEmail: SERVICE_ACCOUNT,
          audience: BACKEND_URL,
        },
      },
    },
    updateMask: { paths: ['schedule', 'time_zone'] },
  });
}
