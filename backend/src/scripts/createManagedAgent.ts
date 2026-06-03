/**
 * One-time setup script — run once to create the Managed Agent and Environment
 * in the Anthropic Console. Store the printed IDs as Cloud Run secrets.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx ts-node backend/src/scripts/createManagedAgent.ts
 */
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Jsi datový analytik specializovaný na agregaci worklogů do přehledových tabulek.

Dostaneš konfiguraci (dimenze, časové seskupení, období) a seznam worklogů ve formátu JSON.
Tvojím úkolem je agregovat worklogy do tabulkové struktury a vrátit POUZE JSON v code blocku.

Pokyny pro agregaci:
1. Pro každý worklog zjisti hodnotu každé dimenze:
   - user → pole "user"
   - issueKey → pole "issueKey"
   - parentKey → pole "parentKey"
   - parentSummary → pole "parentSummary"
   - sprint → pole "sprint"
   - components → první hodnota z pole "components" nebo "(bez komponenty)"
   - issueType → pole "issueType"
   - priority → pole "priority"
2. Každá unikátní kombinace dimenzí tvoří jeden řádek
3. Hodnoty (hodiny) = seconds / 3600, zaokrouhli na 2 desetinná místa
4. Seskup hodnoty do časových sloupců podle pole "date":
   - day → "YYYY-MM-DD"
   - week → "YYYY-WNN" (ISO týden, např. "2026-W22")
   - month → "YYYY-MM"
   - quarter → "YYYY-QN" (např. "2026-Q2")
   - year → "YYYY"
5. Zahrň pouze sloupce s alespoň jedním nenulovým záznamem, seřazené chronologicky

Požadovaný formát odpovědi:
\`\`\`json
{
  "columns": [
    { "key": "2026-05", "label": "Květen 2026" }
  ],
  "rows": [
    {
      "user": "Jan Novák",
      "_values": { "2026-05": 8.5 }
    }
  ]
}
\`\`\`

Pravidla pro "label" sloupce:
- day: "DD. MM. YYYY"
- week: "Týden NN, YYYY"
- month: česky (Leden/Únor/Březen/Duben/Květen/Červen/Červenec/Srpen/Září/Říjen/Listopad/Prosinec + rok)
- quarter: "Q1-Q4 YYYY"
- year: "YYYY"

Vrať POUZE JSON v code blocku, bez dalšího textu.`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Chybí ANTHROPIC_API_KEY');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('Vytváření prostředí (Environment)...');
  const environment = await client.beta.environments.create({
    name: 'mytime-smart-reports',
    config: { type: 'cloud', networking: { type: 'unrestricted' } },
  });
  console.log('Environment ID:', environment.id);

  console.log('Vytváření agenta...');
  const agent = await client.beta.agents.create({
    name: 'MyTime Smart Reports',
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM_PROMPT,
    tools: [{ type: 'agent_toolset_20260401', default_config: { enabled: true } }],
  });
  console.log('Agent ID:', agent.id);
  console.log('Agent version:', agent.version);

  console.log('\n=== Přidej tyto hodnoty jako secrets v Cloud Run ===');
  console.log(`MANAGED_AGENT_ID=${agent.id}`);
  console.log(`MANAGED_ENV_ID=${environment.id}`);
  console.log('\nPříkazy pro Google Secret Manager:');
  console.log(`echo -n "${agent.id}" | gcloud secrets create MANAGED_AGENT_ID --data-file=-`);
  console.log(`echo -n "${environment.id}" | gcloud secrets create MANAGED_ENV_ID --data-file=-`);
  console.log('\nMapování do Cloud Run:');
  console.log('gcloud run services update mytime-backend \\');
  console.log('  --update-secrets MANAGED_AGENT_ID=MANAGED_AGENT_ID:latest,MANAGED_ENV_ID=MANAGED_ENV_ID:latest \\');
  console.log('  --region europe-west1');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
