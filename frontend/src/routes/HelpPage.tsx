import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails, Divider, Chip } from '@mui/material';
import { ExpandMore, CloudDownload, FolderSpecial, Business, Assessment, History, Person, ManageAccounts, AutoAwesome, LightbulbOutlined } from '@mui/icons-material';
import { BRAND } from '../theme';

interface Section {
  icon: JSX.Element;
  title: string;
  role?: string;
  description: string;
  steps: string[];
  examples?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: <CloudDownload />,
    title: 'Stažení dat',
    role: 'Admin',
    description: 'Slouží ke stažení (synchronizaci) worklogů z Jiry a absencí z Activity Timeline do aplikace. Bez synchronizace se data v aplikaci neaktualizují. Stránka obsahuje jak manuální spuštění, tak nastavení automatického plánovaného syncu.',
    steps: [
      'Inkrementální sync (bez zadání dat): stáhne pouze záznamy, které v databázi ještě nejsou. Rychlý a bezpečný — existující data nepřepíše.',
      'Override sync (zadej Datum od a Datum do): přepíše veškerá data v daném rozsahu čerstvými daty z Jiry. Použij při opravě nebo zpětném doplnění dat.',
      'Po dokončení se zobrazí počet uložených worklogů, absencí a aktualizovaných rolí. Případná chyba Activity Timeline je zobrazena odděleně a neblokuje uložení worklogů.',
      'Plánovaný sync: v sekci „Plánovaný sync" nastav frekvenci (denně / týdně / měsíčně), čas spuštění a které období stahovat (aktuální nebo předchozí měsíc). Nastavení uloží zelená hláška.',
      'Synchronizace zároveň aktualizuje seznam členů a jejich role (user / freelancer) z Activity Timeline do kolekce members.',
    ],
    examples: [
      'Konec měsíce: spusť override sync pro uplynulý měsíc — zajistí se, že jsou načteny i záznamy, které Jira zapsala se zpožděním.',
      'Zpětná oprava: pokud zaměstnanec opravil worklogy zpětně přímo v Jiře, spusť override sync pro dané datum.',
      'Doporučené nastavení automatického syncu: denně ve 23:00 na předchozí den nebo měsíčně 1. dne v měsíci pro předchozí měsíc.',
    ],
  },
  {
    icon: <FolderSpecial />,
    title: 'Projektový výkaz',
    role: 'Admin, Freelancer',
    description: 'Přehled worklogů seskupených podle projektů a komponent. Určeno primárně pro freelancery pro přehled vlastní práce na projektech, nebo pro adminy při kontrole.',
    steps: [
      'Vyber zaměstnance (admin) nebo uživatele (freelancer vidí vždy svá vlastní data) a měsíc.',
      'Tabulka zobrazuje záznamy s datem, issue klíčem, názvem úkolu, hodinami a komentářem.',
      'V odemčeném měsíci lze záznamy editovat kliknutím na ikonu tužky.',
      'Export do CSV, Excel nebo PDF tlačítky vpravo dole.',
    ],
    examples: [
      'Měsíční výkaz pro klienta: vyber freelancera, zvol měsíc a exportuj do PDF.',
    ],
  },
  {
    icon: <Business />,
    title: 'Docházka',
    role: 'Admin, Uživatel',
    description: 'Detailní přehled docházky zaměstnance za vybraný měsíc. Obsahuje souhrn odpracovaných hodin, přesčasů, dovolené a nemoci a podrobnou tabulku worklogů s automaticky vloženou polední pauzou.',
    steps: [
      'Admini vidí všechny zaměstnance, běžní uživatelé pouze svá vlastní data.',
      'Filtr Vše / CZ / SK zúží seznam zaměstnanců podle země. Přepnutí filtru zachovává vybraného zaměstnance, patří-li do dané skupiny.',
      'Souhrn zobrazuje: odpracované hodiny vs. fond, přesčasy, dovolené, nemocenské a svátky.',
      'Záznamy v tabulce lze v odemčeném měsíci editovat (ikona tužky), vrátit do původního stavu (ikona zpět) nebo zobrazit historii změn (ikona hodin).',
      'Tlačítko „Zamknout" / „Odemknout" (vpravo vedle výběru měsíce) uzavře nebo znovu otevře měsíc pro daného zaměstnance.',
      'Export PDF pro konkrétního zaměstnance: klikni na ikonu PDF vpravo dole.',
      'Hromadný export (bez výběru konkrétního uživatele, jen pro adminy): tlačítka „Exportovat vše PDF", „Exportovat CZ PDF" nebo „Exportovat SK PDF" — vygenerují jeden soubor, ve kterém jsou postupně všichni zaměstnanci, každý ve svém oddílu.',
    ],
    examples: [
      'Měsíční uzávěrka: přepni na předchozí měsíc, zkontroluj záznamy a exportuj „Exportovat CZ PDF" + „Exportovat SK PDF" pro oddělené výkazy.',
      'Oprava záznamu: klikni na ikonu tužky u konkrétního worklogu, uprav čas, issue nebo přidej komentář.',
      'Uzamčení před exportem: uzamkni měsíc tlačítkem — zaměstnanec nadále nemůže záznamy měnit a sync daný měsíc nepřepíše.',
    ],
  },
  {
    icon: <Assessment />,
    title: 'Přehledy',
    role: 'Admin',
    description: 'Podrobná tabulka worklogů pro libovolnou kombinaci zaměstnanců a měsíce. Umožňuje výběr zobrazených sloupců, uložení vlastních exportních šablon a hromadný export.',
    steps: [
      'Vyber jednoho nebo více zaměstnanců z rozbalovacího seznamu. Klikni „Vybrat vše" pro výběr všech zaměstnanců najednou.',
      'Řádky jsou seřazeny chronologicky napříč všemi vybranými zaměstnanci (ne skupinově po zaměstnancích).',
      'Přepínač „Pauzy" zobrazí nebo skryje záznamy polední přestávky.',
      'Klikni na „Sloupce" pro přizpůsobení zobrazených sloupců: Uživatel, Datum, Od, Do, Issue, Název, Hodiny, Komentář, Přesčas, Komponenta, Sprint, Parent.',
      'Pojmenuj a ulož aktuální sadu sloupců jako exportní šablonu — v příštím sezení ji načteš jedním klikem nebo smažeš.',
      'Export: CSV, Excel nebo PDF. Dialog nabídne volitelné zamčení vybraného období po exportu.',
    ],
    examples: [
      'Mzdová účtárna: nastav šablonu s požadovanými sloupci (Datum, Uživatel, Hodiny, Přesčas), ulož ji jako „Mzdy" a příště ji jednoduše načti.',
      'Porovnání týmu: vyber všechny zaměstnance a exportuj do Excelu pro vlastní zpracování.',
      'Export bez zamčení: v potvrzovacím dialogu zruš zaškrtnutí „Zamknout období" — worklogy zůstanou editovatelné.',
    ],
  },
  {
    icon: <AutoAwesome />,
    title: 'Chytré přehledy',
    role: 'Admin, Uživatel, Freelancer',
    description: 'Interaktivní pivotní tabulka poháněná AI (Claude). Slouží k analýze odpracovaných hodin po libovolných dimenzích a časových úsecích — např. kolik kdo strávil na projektech v každém měsíci. Výsledek sestaví AI agent na základě konfigurace, sestavení trvá 10–30 sekund.',
    steps: [
      'Krok 1 — Načtení dat: zadej rozsah „Od" a „Do" a klikni „Načíst data". Načtou se všechny worklogy za dané období, včetně editovaných a ručně přidaných. Po načtení se zobrazí počet worklogů.',
      'Krok 2 — Konfigurace tabulky: (volitelně) filtruj zaměstnance, komponenty a projekt/epic. Nastav Sloupce (čas): po dnech / týdnech / měsících / čtvrtletích / letech. Vyber až 3 dimenze řádků (např. Projekt → Uživatel).',
      'Krok 3 — Sestavení přehledu: klikni „Sestavit přehled". Claude analyzuje data a vrátí hotovou pivotní tabulku.',
      'Ve výsledné tabulce lze: řadit kliknutím na záhlaví, filtrovat textem (hledej jméno, projekt, issue…), nastavit minimální počet hodin nebo skrýt nulové řádky.',
      'Řádek „Celkem" ve spodní části tabulky agreguje hodnoty všech zobrazených řádků.',
      'Export výsledné tabulky do CSV, Excel nebo PDF tlačítky vpravo nahoře výsledku.',
    ],
    examples: [
      'Přehled na projekt Q1: načti 2026-01-01 – 2026-03-31, dimenze Projekt (název) → Uživatel, sloupce po měsících — okamžitě vidíš kolik kdo strávil na každém projektu v každém měsíci.',
      'Kapacita týmu v aktuálním měsíci: načti aktuální měsíc, dimenze Uživatel, sloupce po týdnech — rychle porovnáš vytíženost jednotlivých kolegů.',
      'Bugfix vs. feature: nastav 1. dimenzi Typ (Bug/Task…), 2. dimenzi Uživatel, sloupce po měsících — uvidíš poměr práce na bugech a nových funkcích.',
    ],
  },
  {
    icon: <History />,
    title: 'Historie změn',
    role: 'Admin',
    description: 'Protokol všech editací worklogů — kdo, kdy a co změnil. Záznamy jsou seřazeny od nejnovějších.',
    steps: [
      'Filtruj dle zaměstnance a měsíce.',
      'Každý řádek zobrazuje: zaměstnance, issue, pole které bylo změněno, původní a novou hodnotu, čas změny a e-mail autora změny.',
      'Akce „revert" znamená vrácení worklogu do původního stavu (smazání editovaného overlaye).',
      'Záznamy jsou pouze ke čtení — z tohoto pohledu nelze změny přímo vrátit.',
    ],
    examples: [
      'Kontrola před uzávěrkou: filtruj na daný měsíc a projdi, zda všechny úpravy odpovídají skutečnosti.',
      'Audit: v případě sporu o hodiny lze přesně zjistit kdy a kým byl záznam upraven.',
    ],
  },
  {
    icon: <Person />,
    title: 'Přehled zaměstnance',
    role: 'Admin, Uživatel',
    description: 'Souhrnné statistiky zaměstnance za vybraný měsíc: odpracované hodiny vs. fond, dovolené, nemoci, svátky, přesčasy a tabulka konkrétních absencí.',
    steps: [
      'Admin vybírá zaměstnance ze seznamu, volitelně filtruje přepínačem Vše / CZ / SK. Běžný uživatel vidí vždy svá vlastní data.',
      'Karta „Odpracováno" ukazuje skutečné hodiny / fond. Fond = počet pracovních dnů × 8 h, ze kterého jsou odečteny státní svátky. CZ a SK zaměstnanci mají jiný sváteční kalendář — aplikace to automaticky zohledňuje.',
      'Karty Dovolená, Nemoc, Volno a Přesčas zobrazují součty za daný měsíc v hodinách.',
      'Pod kartami je tabulka konkrétních dní absence s typem (Dovolená / Nemoc / Volno / Svátek).',
      'Absence se zobrazují pouze po provedené synchronizaci z Activity Timeline.',
    ],
    examples: [
      'Kontrola dovolené: rychlý přehled kolik dní dovolené zaměstnanec čerpal v daném měsíci a které dny to byly.',
      'SK zaměstnanec s nesprávným fondem: přepnutím filtru na SK se fond automaticky přepočítá na slovenský sváteční kalendář.',
    ],
  },
  {
    icon: <ManageAccounts />,
    title: 'Správa uživatelů',
    role: 'Admin',
    description: 'Správa účtů zaměstnanců — schválení nových registrací, přiřazení rolí a Jira accountů, blokování a mazání.',
    steps: [
      'Nový uživatel se zaregistruje e-mailem (@it-dc.cz nebo @it-dc.sk). Dokud ho admin neschválí (status „Čekající"), vidí jen čekací obrazovku.',
      'Admin klikne „Aktivovat" u čekajícího uživatele — tím se zpřístupní aplikace.',
      'Přiřaď správné Jira Account ID: bez něj se uživateli nezobrazí žádné worklogy ani absence.',
      'Role uživatele: „Uživatel" — vidí vlastní Docházku a Přehled zaměstnance; „Admin" — přístup ke všem datům, synchronizaci a správě; „Freelancer" — Projektový výkaz a Chytré přehledy.',
      'Status „Blokovaný": uživatel se nemůže přihlásit, ale jeho data v aplikaci zůstávají zachována.',
      'Smazání uživatele je nevratné — smaže Firebase účet, worklogy a absence v Jira/Activity Timeline zůstanou.',
    ],
    examples: [
      'Nástup zaměstnance: zaregistruje se, admin ho aktivuje a přiřadí jeho Jira Account ID — od té chvíle se načítají jeho worklogy.',
      'Odchod zaměstnance: nastav status na „Blokovaný" (historická data zůstanou dostupná adminovi, účet nelze použít k přihlášení).',
    ],
  },
];

export function HelpPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Nápověda</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Popis jednotlivých sekcí aplikace, návod k použití a příklady z praxe.
      </Typography>

      <Paper sx={{ p: 3 }}>
        {SECTIONS.map((section, i) => (
          <Box key={section.title}>
            <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, mr: 1 }}>
                  <Box sx={{ color: BRAND.teal }}>{section.icon}</Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{section.title}</Typography>
                  {section.role && (
                    <Chip
                      label={section.role}
                      size="small"
                      sx={{ ml: 'auto', fontSize: '0.7rem', height: 20, bgcolor: 'rgba(0,36,73,0.07)', color: 'text.secondary' }}
                    />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pt: 0 }}>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {section.description}
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: 'text.primary' }}>
                  Jak na to
                </Typography>
                <Box component="ol" sx={{ m: 0, pl: 2.5, mb: section.examples ? 2 : 0 }}>
                  {section.steps.map((step, j) => (
                    <Box component="li" key={j} sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{step}</Typography>
                    </Box>
                  ))}
                </Box>

                {section.examples && section.examples.length > 0 && (
                  <Box sx={{ background: 'rgba(139,170,69,0.07)', borderLeft: `3px solid ${BRAND.teal}`, borderRadius: 1, px: 2, py: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <LightbulbOutlined sx={{ fontSize: 16, color: BRAND.teal }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: BRAND.teal }}>Příklady použití</Typography>
                    </Box>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {section.examples.map((ex, k) => (
                        <Box component="li" key={k} sx={{ mb: 0.25 }}>
                          <Typography variant="body2" color="text.secondary">{ex}</Typography>
                        </Box>
                      ))}
                    </Box>
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
