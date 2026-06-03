const ExcelJS = require('exceljs');

const tests = [
  // ─── PŘIHLÁŠENÍ A REGISTRACE ───────────────────────────────────────────────
  ['TC-001', 'Přihlášení', 'Přihlášení admina', 'Admin', 'Existující admin účet', '1. Otevři aplikaci\n2. Zadej email a heslo admina\n3. Klikni Přihlásit se', 'Přesměrování na /download, zobrazí se admin menu'],
  ['TC-002', 'Přihlášení', 'Přihlášení usera', 'User', 'Existující aktivní user účet', '1. Zadej email a heslo usera\n2. Klikni Přihlásit se', 'Přesměrování na /company, zobrazí se user menu'],
  ['TC-003', 'Přihlášení', 'Přihlášení freelancera', 'Freelancer', 'Existující freelancer účet', '1. Zadej email a heslo freelancera\n2. Klikni Přihlásit se', 'Přesměrování na /company, viditelné tlačítko Stáhnout PDF'],
  ['TC-004', 'Přihlášení', 'Neplatné přihlašovací údaje', 'Kdokoliv', 'Libovolný účet', '1. Zadej nesprávné heslo\n2. Klikni Přihlásit se', 'Zobrazí se chybová hláška, uživatel zůstane na /login'],
  ['TC-005', 'Registrace', 'Registrace s platnou doménou', 'Nový uživatel', 'Žádný účet', '1. Klikni Registrovat se\n2. Zadej email @it-dc.cz\n3. Vyplň jméno a heslo\n4. Odešli', 'Účet vytvořen, obrazovka "čeká na schválení"'],
  ['TC-006', 'Registrace', 'Registrace s neplatnou doménou', 'Nový uživatel', 'Žádný účet', '1. Klikni Registrovat se\n2. Zadej email @gmail.com\n3. Pokus se odeslat', 'Formulář zobrazí chybu, odeslání zablokováno'],
  ['TC-007', 'Přihlášení', 'Pending účet – čekací obrazovka', 'Pending user', 'Účet se statusem pending', '1. Přihlas se jako pending user', 'Obrazovka "Účet čeká na schválení", bez přístupu do aplikace'],
  ['TC-008', 'Přihlášení', 'Blocked účet – blokovací obrazovka', 'Blocked user', 'Účet se statusem blocked', '1. Přihlas se jako blocked user', 'Obrazovka "Účet zablokován", bez přístupu do aplikace'],
  ['TC-009', 'Přihlášení', 'Odhlášení', 'Kdokoliv', 'Přihlášený uživatel', '1. Klikni ikonu odhlášení v levém dolním rohu sidebaru', 'Uživatel odhlášen, přesměrován na /login'],

  // ─── SPRÁVA UŽIVATELŮ ──────────────────────────────────────────────────────
  ['TC-010', 'Správa uživatelů', 'Zobrazení seznamu uživatelů', 'Admin', 'Přihlášen jako admin', '1. Jdi na /admin/users', 'Zobrazí se tabulky: čekající, aktivní, zablokovaní'],
  ['TC-011', 'Správa uživatelů', 'Non-admin nemá přístup', 'User / Freelancer', 'Přihlášen jako user nebo freelancer', '1. Zkus přejít na /admin/users', 'Přesměrování na /company'],
  ['TC-012', 'Správa uživatelů', 'Schválení pending uživatele', 'Admin', 'Existuje pending user', '1. V sekci "Čekající" klikni Schválit', 'Uživatel přesunut do Aktivní, status = active'],
  ['TC-013', 'Správa uživatelů', 'Zamítnutí pending uživatele', 'Admin', 'Existuje pending user', '1. V sekci "Čekající" klikni Zamítnout', 'Uživatel přesunut do Zablokovaní'],
  ['TC-014', 'Správa uživatelů', 'Zablokování aktivního uživatele', 'Admin', 'Existuje aktivní user', '1. U aktivního usera klikni ikonu blokování', 'Uživatel přesunut do Zablokovaní, nemůže se přihlásit'],
  ['TC-015', 'Správa uživatelů', 'Odblokování uživatele', 'Admin', 'Existuje blocked user', '1. V sekci Zablokovaní klikni Odblokovat', 'Uživatel přesunut zpět do Aktivní'],
  ['TC-016', 'Správa uživatelů', 'Přepnutí role: Admin → User', 'Admin', 'Existuje admin (ne poslední)', '1. U admina klikni ikonu přepnutí role\n2. Potvrď dialog', 'Role změní na User, chip šedý s nápisem "User"'],
  ['TC-017', 'Správa uživatelů', 'Přepnutí role: User → Freelancer', 'Admin', 'Existuje user', '1. U usera klikni ikonu přepnutí role', 'Role změní na Freelancer, chip modrý s nápisem "Freelancer"'],
  ['TC-018', 'Správa uživatelů', 'Přepnutí role: Freelancer → Admin', 'Admin', 'Existuje freelancer', '1. U freelancera klikni ikonu přepnutí role', 'Role změní na Admin, chip fialový s nápisem "Admin"'],
  ['TC-019', 'Správa uživatelů', 'Ochrana posledního admina', 'Admin', 'V systému je pouze jeden admin', '1. Pokus se změnit roli posledního admina', 'Zobrazí se varování, akce vyžaduje potvrzení'],
  ['TC-020', 'Správa uživatelů', 'Přiřazení Jira Account ID', 'Admin', 'User bez Jira ID', '1. Klikni ikonu přiřazení Jira účtu\n2. Zadej ID\n3. Ulož', 'ID zobrazeno v tabulce u daného uživatele'],
  ['TC-021', 'Správa uživatelů', 'Smazání uživatele', 'Admin', 'Existuje user (ne poslední admin)', '1. Klikni ikonu smazání\n2. Potvrď', 'Uživatel odstraněn z tabulky i z Firebase Auth'],

  // ─── SYNCHRONIZACE DAT ─────────────────────────────────────────────────────
  ['TC-022', 'Synchronizace', 'Inkrementální sync', 'Admin', 'Přihlášen jako admin', '1. Jdi na Stažení dat\n2. Klikni Stáhnout bez zadání datumů', 'Sync proběhne, zobrazí se počet worklogů a absencí'],
  ['TC-023', 'Synchronizace', 'Override sync s datumy', 'Admin', 'Přihlášen jako admin', '1. Zadej Datum od a Datum do\n2. Klikni Stáhnout', 'Data v rozsahu přepsána, zobrazen počet záznamů'],
  ['TC-024', 'Synchronizace', 'Non-admin nemá přístup na sync', 'User / Freelancer', 'Přihlášen jako user', '1. Zkus přejít na /download', 'Přesměrování na /company'],

  // ─── DOCHÁZKA ──────────────────────────────────────────────────────────────
  ['TC-025', 'Docházka', 'Admin vidí dropdown výběru zaměstnance', 'Admin', 'Přihlášen jako admin, existují data', '1. Jdi na Docházka\n2. Zkontroluj dropdown "Uživatel"', 'Dropdown je viditelný se seznamem zaměstnanců'],
  ['TC-026', 'Docházka', 'Freelancer NENÍ v dropdownu admina', 'Admin', 'Existuje freelancer se spárovaným Jira ID', '1. Otevři dropdown Uživatel v Docházce', 'Freelancer se v dropdownu nezobrazí'],
  ['TC-027', 'Docházka', 'Stats karty po výběru zaměstnance', 'Admin', 'Vybraný zaměstnanec má data', '1. Vyber zaměstnance\n2. Zkontroluj karty nad tabulkou', 'Karty: Odpracováno/Fond, Dovolená, Nemoc, Přesčas, Dnů s přesčasem'],
  ['TC-028', 'Docházka', 'Výpočet přesčasu – překročení fondu', 'Admin', 'Zaměstnanec s přesčasem', '1. Vyber zaměstnance\n2. Zkontroluj kartu Přesčas', 'Karta Přesčas zobrazuje kladnou hodnotu v hodinách'],
  ['TC-029', 'Docházka', 'Přesčas = 0 při nepřekročení fondu', 'Admin', 'Zaměstnanec bez přesčasu', '1. Vyber zaměstnance bez přesčasu', 'Karta Přesčas zobrazuje 0,0 h'],
  ['TC-030', 'Docházka', 'Day Off se počítá jako Dovolená', 'Admin', 'Zaměstnanec má DAY_OFF absenci', '1. Vyber zaměstnance s Day Off\n2. Zkontroluj kartu Dovolená', 'Hodiny Day Off jsou zahrnuty v kartě Dovolená'],
  ['TC-031', 'Docházka', 'Absence v hodinách (ne dnech)', 'Admin', 'Zaměstnanec má dovolené/nemoci', '1. Zkontroluj karty Dovolená a Nemoc', 'Hodnoty jsou v hodinách (např. "8,0 h"), ne v dnech'],
  ['TC-032', 'Docházka', 'Admin zamkne měsíc', 'Admin', 'Vybraný zaměstnanec, odemknutý měsíc', '1. Vyber zaměstnance\n2. Klikni Zamknout\n3. Potvrď', 'Badge "Zamknuto" viditelný, zaměstnanec nemůže editovat'],
  ['TC-033', 'Docházka', 'Admin odemkne měsíc', 'Admin', 'Zamknutý měsíc', '1. Klikni Odemknout', 'Měsíc odemknut, zaměstnanec může editovat'],
  ['TC-034', 'Docházka', 'User vidí pouze svá data', 'User', 'Přihlášen jako user se spárovaným Jira ID', '1. Přihlas se jako user\n2. Jdi na Docházka', 'Dropdown není viditelný, zobrazena vlastní data'],
  ['TC-035', 'Docházka', 'User NEVIDÍ tlačítko Stáhnout PDF', 'User', 'Přihlášen jako user', '1. Jdi na Docházka', 'Tlačítko "Stáhnout PDF" není viditelné'],
  ['TC-036', 'Docházka', 'User nemůže editovat zamknutý měsíc', 'User', 'Zamknutý měsíc', '1. Přihlas se jako user\n2. Jdi na Docházka\n3. Pokus se editovat záznam', 'Editace není možná'],
  ['TC-037', 'Docházka', 'Freelancer vidí svá data + stats', 'Freelancer', 'Přihlášen jako freelancer se spárovaným Jira ID', '1. Přihlas se jako freelancer\n2. Jdi na Docházka', 'Zobrazí se vlastní data a stats karty'],
  ['TC-038', 'Docházka', 'Freelancer vidí tlačítko Stáhnout PDF', 'Freelancer', 'Přihlášen jako freelancer', '1. Jdi na Docházka', 'Tlačítko "Stáhnout PDF" je viditelné nad tabulkou'],
  ['TC-039', 'Docházka', 'PDF – titulek obsahuje jméno a měsíc', 'Freelancer', 'Freelancer s daty', '1. Klikni Stáhnout PDF\n2. Otevři soubor', 'Titulek: "Docházka – Jan Novák – Květen 2026"'],
  ['TC-040', 'Docházka', 'PDF – stats hlavička', 'Freelancer', 'Freelancer s daty', '1. Klikni Stáhnout PDF\n2. Zkontroluj horní část', 'Karty s Odpracováno/Fond, Dovolená, Nemoc, Přesčas, Dnů s přesčasem'],
  ['TC-041', 'Docházka', 'PDF – tabulka bez pauz', 'Freelancer', 'Freelancer s daty', '1. Klikni Stáhnout PDF\n2. Zkontroluj tabulku', 'Záznamy: Datum, Od, Do, Hodiny, Issue, Popis. Polední pauzy nejsou zahrnuty'],

  // ─── PROJEKTOVÝ VÝKAZ ──────────────────────────────────────────────────────
  ['TC-042', 'Projektový výkaz', 'Zobrazení worklogů', 'Admin', 'Přihlášen jako admin, existují data', '1. Jdi na Projektový výkaz\n2. Vyber zaměstnance a měsíc', 'Tabulka zobrazí worklogy daného zaměstnance'],
  ['TC-043', 'Projektový výkaz', 'Editace worklogu', 'Admin', 'Vybrán zaměstnanec, odemknutý měsíc', '1. Klikni ikonu editace\n2. Změň hodnotu\n3. Ulož', 'Záznam aktualizován, badge "upraveno" viditelný'],
  ['TC-044', 'Projektový výkaz', 'Historie editací worklogu', 'Admin', 'Worklog byl editován', '1. Klikni ikonu historie u editovaného záznamu', 'Dialog zobrazí historii změn (co, kdo, kdy)'],
  ['TC-045', 'Projektový výkaz', 'Export do Excel', 'Admin', 'Zobrazena data', '1. Klikni tlačítko Excel', 'Stáhne se .xlsx soubor s daty'],
  ['TC-046', 'Projektový výkaz', 'Export do CSV', 'Admin', 'Zobrazena data', '1. Klikni tlačítko CSV', 'Stáhne se .csv soubor'],
  ['TC-047', 'Projektový výkaz', 'Non-admin nemá přístup', 'User / Freelancer', 'Přihlášen jako user', '1. Zkus přejít na /project', 'Přesměrování na /company'],

  // ─── PŘEHLEDY ──────────────────────────────────────────────────────────────
  ['TC-048', 'Přehledy', 'Zobrazení přehledu', 'Admin', 'Přihlášen jako admin', '1. Jdi na Přehledy', 'Tabulka se všemi zaměstnanci a worklogy'],
  ['TC-049', 'Přehledy', 'Filtrování podle zaměstnance', 'Admin', 'Data více zaměstnanců', '1. Vyber zaměstnance z dropdownu', 'Tabulka filtrována na vybraného zaměstnance'],
  ['TC-050', 'Přehledy', 'Export zamkne měsíc', 'Admin', 'Odemknutý měsíc', '1. Klikni Export\n2. Zkontroluj stav měsíce', 'Měsíc se po exportu zamkne'],
  ['TC-051', 'Přehledy', 'Non-admin nemá přístup', 'User / Freelancer', 'Přihlášen jako user', '1. Zkus přejít na /overview', 'Přesměrování na /company'],

  // ─── PŘEHLED ZAMĚSTNANCE ───────────────────────────────────────────────────
  ['TC-052', 'Přehled zaměstnance', 'Admin vidí dropdown výběru', 'Admin', 'Přihlášen jako admin', '1. Jdi na Přehled zaměstnance', 'Dropdown pro výběr zaměstnance je viditelný'],
  ['TC-053', 'Přehled zaměstnance', 'User vidí pouze svá data', 'User', 'Přihlášen jako user', '1. Jdi na Přehled zaměstnance', 'Dropdown není viditelný, zobrazena vlastní data'],
  ['TC-054', 'Přehled zaměstnance', 'Stats karty zobrazeny', 'Admin', 'Vybrán zaměstnanec s daty', '1. Vyber zaměstnance\n2. Zkontroluj karty', 'Karty: Odpracováno/Fond, Dovolená (h), Nemoc (h), Přesčas (h), Dnů s přesčasem'],
  ['TC-055', 'Přehled zaměstnance', 'Tabulka absencí', 'Admin', 'Zaměstnanec má absence', '1. Vyber zaměstnance s absencemi', 'Tabulka absencí s datem a typem (Dovolená/Nemoc/Svátek/Volno)'],
  ['TC-056', 'Přehled zaměstnance', 'Přesčas jen při překročení fondu', 'Admin', 'Různé scénáře zaměstnanců', '1. Zaměstnanec pod fondem → Přesčas\n2. Zaměstnanec nad fondem → Přesčas', 'Pod fondem: 0,0 h. Nad fondem: kladná hodnota'],

  // ─── HISTORIE ZMĚN ─────────────────────────────────────────────────────────
  ['TC-057', 'Historie změn', 'Zobrazení historie editací', 'Admin', 'Existují editované worklogy', '1. Jdi na Historie změn', 'Záznamy: kdo, kdy a co editoval'],
  ['TC-058', 'Historie změn', 'Non-admin nemá přístup', 'User / Freelancer', 'Přihlášen jako user', '1. Zkus přejít na /history', 'Přesměrování na /company'],

  // ─── CHYTRÉ PŘEHLEDY ───────────────────────────────────────────────────────
  ['TC-059', 'Chytré přehledy', 'Admin vidí chytré přehledy', 'Admin', 'Přihlášen jako admin', '1. Jdi na Chytré přehledy', 'Stránka se zobrazí bez chyby'],
  ['TC-060', 'Chytré přehledy', 'User vidí chytré přehledy', 'User', 'Přihlášen jako user', '1. Jdi na Chytré přehledy', 'Stránka se zobrazí bez chyby'],

  // ─── NÁPOVĚDA ──────────────────────────────────────────────────────────────
  ['TC-061', 'Nápověda', 'Admin vidí nápovědu', 'Admin', 'Přihlášen jako admin', '1. Klikni Nápověda v sidebaru', 'Zobrazí se nápověda se sekcí "Docházka"'],
  ['TC-062', 'Nápověda', 'Non-admin nemá přístup na nápovědu', 'User / Freelancer', 'Přihlášen jako user', '1. Zkus přejít na /napoveda', 'Přesměrování na /company, v sidebaru není Nápověda'],

  // ─── ZABEZPEČENÍ ───────────────────────────────────────────────────────────
  ['TC-063', 'Zabezpečení', 'Pouze admin může měnit role', 'User', 'Přihlášen jako user', '1. Zkus přejít na /admin/users', 'Přesměrování, změna role není dostupná'],
  ['TC-064', 'Zabezpečení', 'Zamykání dostupné jen adminovi', 'User / Freelancer', 'Přihlášen jako user nebo freelancer', '1. Jdi na Docházka', 'Tlačítko Zamknout/Odemknout není viditelné'],
  ['TC-065', 'Zabezpečení', 'Freelancer nevidí ostatní zaměstnance', 'Freelancer', 'Přihlášen jako freelancer', '1. Jdi na Docházka\n2. Hledej dropdown výběru', 'Dropdown není viditelný, zobrazena jen vlastní data'],
  ['TC-066', 'Zabezpečení', 'Rate limiting backendu', 'Kdokoliv', 'Přístup k backendu', '1. Odešli rychle více než 100 requestů do 15 minut', 'Backend vrátí HTTP 429 Too Many Requests'],
];

// Barvy sekcí
const SECTION_COLORS = {
  'Přihlášení':           'FFF3CD',
  'Registrace':           'FFF3CD',
  'Správa uživatelů':     'D4EDDA',
  'Synchronizace':        'D1ECF1',
  'Docházka':             'E2D9F3',
  'Projektový výkaz':     'FDDCBC',
  'Přehledy':             'D6E8FF',
  'Přehled zaměstnance':  'FCE4EC',
  'Historie změn':        'F0F4C3',
  'Chytré přehledy':      'E0F7FA',
  'Nápověda':             'F3E5F5',
  'Zabezpečení':          'FFEBEE',
};

const STATUS_COL_COLOR = 'F8F9FA';

async function generate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MyTime TestPlan Generator';
  wb.created = new Date();

  const ws = wb.addWorksheet('Testovací plán', {
    views: [{ state: 'frozen', ySplit: 2 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // ── Nadpis ────────────────────────────────────────────────────────────────
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'MyTime – Testovací plán';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C3A5E' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 32;

  // ── Hlavička sloupců ──────────────────────────────────────────────────────
  const headers = ['ID', 'Sekce', 'Název testu', 'Role', 'Předpoklady', 'Kroky testování', 'Očekávaný výsledek', 'Skutečný výsledek', 'Stav', 'Poznámka'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C5F8A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF1A3F5C' } },
      bottom: { style: 'thin', color: { argb: 'FF1A3F5C' } },
      left:   { style: 'thin', color: { argb: 'FF1A3F5C' } },
      right:  { style: 'thin', color: { argb: 'FF1A3F5C' } },
    };
  });

  // ── Data ──────────────────────────────────────────────────────────────────
  for (const [id, sekce, nazev, role, predpoklady, kroky, ocekavany] of tests) {
    const row = ws.addRow([id, sekce, nazev, role, predpoklady, kroky, ocekavany, '', '', '']);
    const bgHex = SECTION_COLORS[sekce] ?? 'FFFFFF';
    const bgArgb = 'FF' + bgHex;

    row.height = Math.max(40, kroky.split('\n').length * 16);
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const isResultCol = colNum === 8;
      const isStatusCol = colNum === 9;
      const isNoteCol   = colNum === 10;

      cell.font = { name: 'Calibri', size: 9 };
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: colNum === 1 ? 'center' : 'left' };
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'thin', color: { argb: 'FFAAAAAA' } },
        right:  { style: 'thin', color: { argb: 'FFAAAAAA' } },
      };

      if (isResultCol || isNoteCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      } else if (isStatusCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E6' } };
        cell.font = { name: 'Calibri', size: 9, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'top' };
        // Validace: dropdown pro stav
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Prošel,Neprošel,Přeskočen"'],
          showErrorMessage: true,
          errorTitle: 'Neplatná hodnota',
          error: 'Vyber: Prošel, Neprošel nebo Přeskočen',
        };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      }
    });

    // ID tučně
    const idCell = row.getCell(1);
    idCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1C3A5E' } };
  }

  // ── Silné ohraničení sekcí ────────────────────────────────────────────────
  let prevSekce = null;
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum <= 2) return;
    const sekce = row.getCell(2).value;
    if (sekce && sekce !== prevSekce) {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = {
          ...cell.border,
          top: { style: 'medium', color: { argb: 'FF888888' } },
        };
      });
      prevSekce = sekce;
    }
  });

  // ── Šířky sloupců ─────────────────────────────────────────────────────────
  ws.columns = [
    { key: 'id',       width: 9  },
    { key: 'sekce',    width: 22 },
    { key: 'nazev',    width: 38 },
    { key: 'role',     width: 16 },
    { key: 'predp',    width: 28 },
    { key: 'kroky',    width: 45 },
    { key: 'ocek',     width: 45 },
    { key: 'skutec',   width: 35 },
    { key: 'stav',     width: 13 },
    { key: 'pozn',     width: 25 },
  ];

  // ── Legenda ───────────────────────────────────────────────────────────────
  const legendSheet = wb.addWorksheet('Legenda');
  legendSheet.getColumn(1).width = 20;
  legendSheet.getColumn(2).width = 35;

  const legendTitle = legendSheet.getCell('A1');
  legendTitle.value = 'Legenda barev sekcí';
  legendTitle.font = { bold: true, size: 12 };
  legendSheet.mergeCells('A1:B1');
  legendSheet.getRow(1).height = 20;

  legendSheet.addRow([]);
  let li = 3;
  for (const [sekce, hex] of Object.entries(SECTION_COLORS)) {
    const r = legendSheet.getRow(li);
    r.getCell(1).value = sekce;
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
    r.getCell(1).font = { size: 10 };
    r.getCell(1).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    r.getCell(2).value = 'Testovací sekce';
    r.getCell(2).font = { size: 10 };
    r.height = 18;
    li++;
  }

  const statusRow = legendSheet.getRow(li + 1);
  statusRow.getCell(1).value = 'Sloupec Stav:';
  statusRow.getCell(1).font = { bold: true };
  legendSheet.getRow(li + 2).getCell(1).value = 'Prošel';
  legendSheet.getRow(li + 3).getCell(1).value = 'Neprošel';
  legendSheet.getRow(li + 4).getCell(1).value = 'Přeskočen';

  await wb.xlsx.writeFile('TestPlan_MyTime.xlsx');
  console.log('✅ TestPlan_MyTime.xlsx vygenerován (' + tests.length + ' testovacích případů)');
}

generate().catch(err => { console.error(err); process.exit(1); });
