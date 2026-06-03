import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface SmartReportRequest {
  worklogs: {
    worklogId: string;
    user: string;
    accountId: string;
    date: string;
    seconds: number;
    issueKey: string;
    summary: string;
    parentKey: string;
    parentSummary: string;
    components: string[];
    sprint: string;
    issueType: string;
    priority: string;
  }[];
  dimensions: string[];
  timeGrouping: 'day' | 'week' | 'month' | 'quarter' | 'year';
  dateRange: { from: string; to: string };
}

export type SmartReportRow = Record<string, string> & { _values: Record<string, number> };

export interface SmartReportResponse {
  columns: { key: string; label: string }[];
  rows: SmartReportRow[];
}

const DIMENSION_LABELS: Record<string, string> = {
  user: 'Uživatel',
  issueKey: 'Issue',
  parentKey: 'Parent',
  parentSummary: 'Projekt',
  sprint: 'Sprint',
  components: 'Komponenta',
  issueType: 'Typ',
  priority: 'Priorita',
};

router.post('/', authenticate, async (req, res) => {
  const body = req.body as SmartReportRequest;

  if (!body.worklogs || !body.dimensions || !body.timeGrouping || !body.dateRange) {
    return res.status(400).json({ error: 'Chybí povinná pole' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY není nastaven' });
  }

  const agentId = process.env.MANAGED_AGENT_ID?.trim();
  const envId = process.env.MANAGED_ENV_ID?.trim();

  if (!agentId || !envId) {
    logger.warn('Managed agent IDs not configured, falling back to direct API');
    return fallbackToDirectApi(body, res);
  }

  try {
    const session = await client.beta.sessions.create({
      agent: { type: 'agent', id: agentId },
      environment_id: envId,
    });

    const userMessage = buildUserMessage(body);
    let fullText = '';

    await Promise.all([
      (async () => {
        const stream = await client.beta.sessions.events.stream(session.id);
        for await (const event of stream) {
          if (event.type === 'agent.message') {
            for (const block of event.content) {
              if (block.type === 'text') fullText += block.text;
            }
          }
          if (event.type === 'session.status_idle' || event.type === 'session.status_terminated') {
            break;
          }
        }
      })(),
      client.beta.sessions.events.send(session.id, {
        events: [{ type: 'user.message', content: [{ type: 'text', text: userMessage }] }],
      }),
    ]);

    client.beta.sessions.archive(session.id).catch(() => {});

    return parseAndRespond(fullText, res);
  } catch (err: any) {
    logger.error('Smart reports (managed agent) error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

async function fallbackToDirectApi(body: SmartReportRequest, res: any) {
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: buildUserMessage(body) }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return parseAndRespond(text, res);
  } catch (err: any) {
    logger.error('Smart reports (direct API) error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
}

function parseAndRespond(text: string, res: any) {
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) {
    logger.error('Agent nevrátil JSON', { text: text.slice(0, 500) });
    return res.status(500).json({ error: 'Agent nevrátil validní JSON' });
  }
  try {
    const parsed: SmartReportResponse = JSON.parse(jsonMatch[1]);
    return res.json(parsed);
  } catch (err: any) {
    logger.error('JSON parse error', { err: err.message, text: text.slice(0, 500) });
    return res.status(500).json({ error: 'Chyba při parsování JSON odpovědi' });
  }
}

function buildUserMessage(body: SmartReportRequest): string {
  const { worklogs, dimensions, timeGrouping, dateRange } = body;
  const dimLabels = dimensions.map(d => DIMENSION_LABELS[d] ?? d).join(', ');

  return `**Konfigurace přehledu:**
- Dimenze řádků (v tomto pořadí): ${dimensions.join(', ')} (${dimLabels})
- Časové seskupení sloupců: ${timeGrouping}
- Období: ${dateRange.from} až ${dateRange.to}

**Worklogy (${worklogs.length} záznamů):**
\`\`\`json
${JSON.stringify(worklogs.slice(0, 500), null, 0)}
\`\`\`
${worklogs.length > 500 ? `\n(Zobrazeno prvních 500 z ${worklogs.length} záznamů.)` : ''}`;
}

export default router;
