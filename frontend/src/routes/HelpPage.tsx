import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails, Divider } from '@mui/material';
import { ExpandMore, CloudDownload, FolderSpecial, Business, Assessment, History, Person, ManageAccounts } from '@mui/icons-material';
import { BRAND } from '../theme';

interface Section {
  icon: JSX.Element;
  title: string;
  description: string;
  steps?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: <CloudDownload />,
    title: 'Stažení dat',
    description: 'Slouží ke stažení (synchronizaci) worklogů z Jiry a absencí z Activity Timeline do aplikace. Bez synchronizace se data v aplikaci neaktualizují.',
    steps: [
      'Bez zadání datumů se stáhnou pouze nové záznamy za aktuální měsíc (inkrementální režim).',
      'Po zadání rozsahu „Datum od" a „Datum do" se všechna data v daném období přepíší (override režim) — hodí se při opravě nebo zpětném doplnění dat.',
      'Po dokončení aplikace zobrazí počet uložených worklogů a absencí. Případná chyba Activity Timeline je zobrazena odděleně a nebrání uložení worklogů.',
    ],
  },
  {
    icon: <FolderSpecial />,
    title: 'Projektový výkaz',
    description: 'Zobrazuje worklogy seskupené podle projektů a komponent. Umožňuje filtrovat dle uživatele, měsíce a projektu.',
    steps: [
      'Vyber uživatele a měsíc pomocí filtrů nahoře.',
      'Tabulka zobrazuje jednotlivé záznamy s datem, issue, názvem úkolu, hodinami a komentářem.',
    ],
  },
  {
    icon: <Business />,
    title: 'Docházka',
    description: 'Přehled docházky zaměstnance za vybraný měsíc. Obsahuje souhrn odpracovaných hodin, přesčasů, dovolené a nemoci, a podrobnou tabulku worklogů s povinnou polední pauzou.',
    steps: [
      'Admini vidí všechny zaměstnance, běžní uživatelé pouze svá vlastní data.',
      'Souhrn nahoře zobrazuje odpracované hodiny vůči fondu, přesčasy, dovolené a nemoc.',
      'V tabulce jsou vždy zobrazeny polední přestávky i přesčasové záznamy.',
      'Export zamkne dané období — zaměstnanci v něm již nebudou moci upravovat záznamy.',
    ],
  },
  {
    icon: <Assessment />,
    title: 'Přehledy',
    description: 'Podrobná tabulka worklogů s možností výběru zobrazených sloupců a uložení vlastních šablon exportu.',
    steps: [
      'Vyber uživatele a měsíc. Použij tlačítko „Sloupce" pro přizpůsobení zobrazených sloupců.',
      'Šablony exportu umožňují uložit preferovanou sadu sloupců a opakovaně ji používat.',
      'Export zamkne vybrané období.',
    ],
  },
  {
    icon: <History />,
    title: 'Historie změn',
    description: 'Protokol všech editací worklogů — kdo, kdy a co změnil. Záznamy jsou seřazeny od nejnovějších.',
    steps: [
      'Filtruj dle uživatele a měsíce.',
      'Každý řádek zobrazuje původní a novou hodnotu upraveného pole.',
      'Záznamy jsou pouze ke čtení, nelze je vrátit zpět přímo z tohoto pohledu.',
    ],
  },
  {
    icon: <Person />,
    title: 'Přehled zaměstnance',
    description: 'Souhrnné statistiky zaměstnance za vybraný měsíc: odpracované hodiny vůči fondu, dovolená, nemoc a přesčasy.',
    steps: [
      'Admin vybírá zaměstnance z rozbalovacího seznamu. Běžný uživatel vidí vždy svá vlastní data.',
      'Karta „Odpracováno / Fond" ukazuje skutečně odpracované hodiny / očekávaný fond (pracovní dny × 8 h, státní svátky odečteny).',
      'Pod kartami je tabulka konkrétních dnů absence v daném měsíci s typem (dovolená, nemoc, svátek, volno).',
      'Data absencí se načítají ze synchronizace z Activity Timeline — bez provedené synchronizace se nezobrazí.',
    ],
  },
  {
    icon: <ManageAccounts />,
    title: 'Správa uživatelů',
    description: 'Správa účtů zaměstnanců — zasílání pozvánek, nastavení rolí a přiřazení Jira účtů.',
    steps: [
      'Nového zaměstnance přidáš zasláním pozvánky — uživatel ji obdrží e-mailem a přes odkaz si vytvoří účet.',
      'Každému uživateli je nutné přiřadit správné Jira Account ID, aby se jeho worklogy a absence správně zobrazovaly.',
      'Roli lze změnit mezi „Uživatel" a „Admin". Blokovaný uživatel se nemůže přihlásit.',
      'Uživatele lze trvale smazat — tato akce je nevratná.',
    ],
  },
];

export function HelpPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Nápověda</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Popis jednotlivých sekcí aplikace a návod k jejich použití.
      </Typography>

      <Paper sx={{ p: 3 }}>
        {SECTIONS.map((section, i) => (
          <Box key={section.title}>
            <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: BRAND.teal }}>{section.icon}</Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{section.title}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pt: 0 }}>
                <Typography color="text.secondary" sx={{ mb: section.steps ? 1.5 : 0 }}>
                  {section.description}
                </Typography>
                {section.steps && (
                  <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                    {section.steps.map((step, j) => (
                      <Box component="li" key={j} sx={{ mb: 0.5 }}>
                        <Typography variant="body2">{step}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
            {i < SECTIONS.length - 1 && <Divider />}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
