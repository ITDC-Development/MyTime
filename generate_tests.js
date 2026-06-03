const XLSX = require('xlsx');

const srcPath = 'C:/Users/MatějHanzlík/Downloads/TestPlan_MyTime (1).xlsx';
const outPath = 'C:/Users/MatějHanzlík/Downloads/TestPlan_MyTime_updated.xlsx';

const SECTION_COLOR = {
  'Přihlášení':          'FFF3CD',
  'Registrace':          'FFF3CD',
  'Správa uživatelů':    'D4EDDA',
  'Synchronizace':       'D1ECF1',
  'Docházka':            'E2D9F3',
  'Projektový výkaz':    'FDDCBC',
  'Přehledy':            'D6E8FF',
  'Přehled zaměstnance': 'FCE4EC',
  'Historie změn':       'F0F4C3',
  'Chytré přehledy':     'E0F7FA',
  'Nápověda':            'F3E5F5',
  'Zabezpečení':         'FFEBEE',
};

// col 0 = FFF3CD always, cols 1-6 = section, col 7 = FAFAFA, col 8 = FFF9E6, col 9 = FAFAFA
function colColor(colIndex, sectionColor) {
  if (colIndex === 0)                  return 'FFF3CD';
  if (colIndex >= 1 && colIndex <= 6)  return sectionColor;
  if (colIndex === 8)                  return 'FFF9E6';
  return 'FAFAFA';
}

function makeCell(value, rgb) {
  return {
    v: value,
    t: 's',
    s: { patternType: 'solid', fgColor: { rgb } },
  };
}

function calcRowHeight(row) {
  // Count lines in Kroky (col 5) and Očekávaný výsledek (col 6)
  const lines5 = String(row[5] || '').split('\n').length;
  const lines6 = String(row[6] || '').split('\n').length;
  const maxLines = Math.max(lines5, lines6, 1);
  if (maxLines <= 2) return 39.95;
  if (maxLines <= 3) return 48;
  if (maxLines <= 5) return 63.95;
  return 80;
}

const wb = XLSX.readFile(srcPath, { cellStyles: true });
const ws = wb.Sheets['Testovací plán'];
const range = XLSX.utils.decode_range(ws['!ref']);
const lastRow = range.e.r;

// ── Oprav styly u existujících prázdných nových řádků (TC-064+) neexistují, ale
//    přepiš styly všech stávajících řádků dle sekcí aby byly konzistentní
const dataRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
for (let r = 2; r <= lastRow; r++) {
  const row = dataRows[r];
  if (!row || !row[0]) continue;
  const sec = String(row[1] || '');
  const secColor = SECTION_COLOR[sec] || 'FFFFFF';
  for (let c = 0; c < 10; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (ws[addr]) {
      ws[addr].s = { patternType: 'solid', fgColor: { rgb: colColor(c, secColor) } };
    }
  }
}

// ── Nové testy Docházka ──────────────────────────────────────────────────────
const newTests = [
  ['TC-064','Docházka','Dovolená – řádek v tabulce (modrý chip)','Admin','Zaměstnanec má dovolenou v daném měsíci','1. Vyber zaměstnance s dovolenou\n2. Zkontroluj tabulku','Řádek dovolené má modré pozadí a chip "Dovolená" ve sloupci Období','','',''],
  ['TC-065','Docházka','Nemoc – řádek v tabulce (zelený chip)','Admin','Zaměstnanec má nemoc v daném měsíci','1. Vyber zaměstnance s nemocí\n2. Zkontroluj tabulku','Řádek nemoci má zelené pozadí a chip "Nemoc" ve sloupci Období','','',''],
  ['TC-066','Docházka','DAY_OFF zobrazí chip "Dovolená"','Admin','Zaměstnanec má DAY_OFF absenci','1. Vyber zaměstnance s DAY_OFF\n2. Zkontroluj řádek absence','Chip ve sloupci Období zobrazuje "Dovolená" (nikoli "DAY_OFF" nebo jiný text)','','',''],
  ['TC-067','Docházka','HOLIDAY se nezobrazuje jako řádek','Admin','Měsíc obsahuje státní svátek','1. Vyber zaměstnance v měsíci se státním svátkem\n2. Zkontroluj tabulku','V tabulce není žádný řádek pro státní svátek. Svátek se pouze odečte z fondu hodin','','',''],
  ['TC-068','Docházka','Absence je vždy první v daný den','Admin','Zaměstnanec má absenci i worklogy ve stejný den','1. Najdi den, kde jsou absence i worklogy\n2. Zkontroluj pořadí řádků','Řádek absence je vždy první pro daný den, teprve po něm následují worklogy','','',''],
  ['TC-069','Docházka','Worklogy časově navazují na absenci','Admin','Den s 4h absencí a worklogy','1. Najdi den s absencí 4 h (08:00–12:00) a worklogy\n2. Zkontroluj časy ve sloupci Období','Absence: 08:00–12:00. První worklog začíná na 12:00, ne znovu na 08:00. Časy na sebe navazují bez překryvů a mezer','','',''],
  ['TC-070','Docházka','Absence nemá tlačítka Upravit ani Historie','Admin','Zaměstnanec má absenci v tabulce','1. Najdi řádek dovolené nebo nemoci\n2. Zkontroluj sloupec Akce','Sloupec Akce je prázdný – ikony tužky (upravit) a hodin (historie) nejsou viditelné','','',''],
  ['TC-071','Docházka','Badge přesčasu viditelný bez sloupce Issue','Admin','Den s přesčasem','1. Skryj sloupec Issue v pickeru sloupců\n2. Zkontroluj řádky přesčasu','Badge přesčasu (oranžový) je stále viditelný ve sloupci Období','','',''],
  ['TC-072','Docházka','Sloupce Datum/Období/Název nelze skrýt','Admin','Přihlášen jako admin','1. Otevři dropdown Sloupce\n2. Zkus kliknout na Datum, Období nebo Název','Všechny tři mají zaškrtnutý checkbox a ikonu zámku. Kliknutí na ně nemá žádný efekt – nelze je odškrtnout','','',''],
  ['TC-073','Docházka','Ostatní sloupce lze skrýt i zobrazit','Admin','Přihlášen jako admin','1. Otevři dropdown Sloupce\n2. Odškrtni sloupec Issue\n3. Znovu zaškrtni','Po odškrtnutí sloupec Issue zmizí z tabulky. Po zaškrtnutí se vrátí','','',''],
  ['TC-074','Docházka','Admin vidí tlačítko Stáhnout PDF','Admin','Vybrán zaměstnanec s daty','1. Vyber zaměstnance\n2. Zkontroluj oblast nad tabulkou','Tlačítko "Stáhnout PDF" je viditelné nad tabulkou','','',''],
  ['TC-075','Docházka','Admin PDF – titulek s Jira jménem zaměstnance','Admin','Vybraný zaměstnanec má nastavené Jira jméno','1. Vyber zaměstnance X\n2. Klikni Stáhnout PDF\n3. Otevři soubor a zkontroluj nadpis','Titulek PDF: "Docházka – [Jira jméno zaměstnance X] – [Měsíc YYYY]". Je tam jméno vybraného zaměstnance, nikoli jméno přihlášeného admina','','',''],
  ['TC-076','Docházka','Dropdown zaměstnanců nezávisí na měsíci','Admin','Přihlášen jako admin, více zaměstnanců','1. Vyber zaměstnance A v červnu\n2. Přepni měsíc na leden (bez odebrání výběru)\n3. Klikni znovu do dropdownu','Dropdown zobrazuje kompletní seznam zaměstnanců – neskrátí se na ty, kteří mají worklogy v lednu','','',''],
  ['TC-077','Docházka','User bez Jira účtu vidí zprávu','User','Přihlášen jako user bez spárovaného jiraAccountId','1. Přihlas se jako user bez Jira účtu\n2. Jdi na Docházka','Zobrazí se zpráva: "Tvůj Jira účet zatím nebyl spárován administrátorem."','','',''],
  ['TC-078','Docházka','Součet hodin v tabulce odpovídá Jira','Admin','Zaměstnanec se synchronizovanými daty','1. V Jira zjisti celkový čas worklogů pro uživatele a měsíc (v sekundách)\n2. Vyděl 3 600 → hodiny\n3. Porovnej s hodnotou "Odpracováno" na stats kartě a součtem sloupce Hodiny','Součet hodin (bez pauz a absencí) = součet sekund z Jira ÷ 3 600. Odchylka max. ±0,02 h','','',''],
  ['TC-079','Docházka','Počet worklogů odpovídá Jira','Admin','Zaměstnanec se synchronizovanými daty','1. V Jira zjisti počet worklogů pro uživatele a měsíc\n2. Spočítej řádky v tabulce – vynech pauzy (italický text) a absence (barevné pozadí)','Počet čistých worklog řádků = počet worklogů importovaných z Jira','','',''],
  ['TC-080','Docházka','Chip absence viditelný i bez sloupce Název','Admin','Zaměstnanec má absenci','1. Skryj sloupec Název v pickeru\n2. Zkontroluj řádek dovolené nebo nemoci','Chip "Dovolená" nebo "Nemoc" je stále viditelný ve sloupci Období','','',''],
  ['TC-081','Docházka','Dovolená v metrikách odpovídá Activity Timeline','Admin','Zaměstnanec má dovolenou nebo DAY_OFF','1. V Activity Timeline zkontroluj hodiny VACATION + DAY_OFF pro daný měsíc\n2. Porovnej s kartou "Dovolená"','Hodnota na kartě Dovolená = součet hodin VACATION + DAY_OFF z Activity Timeline','','',''],
  ['TC-082','Docházka','Nemoc v metrikách odpovídá Activity Timeline','Admin','Zaměstnanec má SICK_LEAVE v Activity Timeline','1. V Activity Timeline zkontroluj hodiny SICK_LEAVE\n2. Porovnej s kartou "Nemoc"','Hodnota na kartě Nemoc = součet hodin SICK_LEAVE z Activity Timeline','','',''],
  ['TC-083','Docházka','Fond se snižuje o státní svátky','Admin','Měsíc obsahuje státní svátek (pracovní den)','1. Ručně spočítej pracovní dny (vynech víkendy a svátky)\n2. Výsledek × 8 = očekávaný fond\n3. Porovnej s kartou "Odpracováno / Fond"','Fond = (počet pracovních dní bez svátků) × 8 h','','',''],
];

const secColor = 'E2D9F3'; // Docházka
newTests.forEach(function(row, i) {
  const rowIndex = lastRow + 1 + i;
  row.forEach(function(val, c) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex, c });
    ws[addr] = makeCell(String(val), colColor(c, secColor));
  });
});

// ── Aktualizuj rozsah ────────────────────────────────────────────────────────
const totalRows = lastRow + newTests.length;
const newRange = XLSX.utils.decode_range(ws['!ref']);
newRange.e.r = totalRows;
ws['!ref'] = XLSX.utils.encode_range(newRange);

// ── Výšky řádků (všechny datové řádky) ──────────────────────────────────────
const allData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const rowHeights = ws['!rows'] ? [...ws['!rows']] : [];
// Zachovej header výšky (r0, r1)
for (let r = 2; r <= totalRows; r++) {
  const row = allData[r];
  if (!row || !row[0]) continue;
  const h = calcRowHeight(row);
  rowHeights[r] = { hpt: h, hpx: h };
}
ws['!rows'] = rowHeights;

// ── Šířky sloupců ────────────────────────────────────────────────────────────
ws['!cols'] = [
  { wch: 8 },   // ID
  { wch: 16 },  // Sekce
  { wch: 38 },  // Název testu
  { wch: 13 },  // Role
  { wch: 36 },  // Předpoklady
  { wch: 55 },  // Kroky testování
  { wch: 55 },  // Očekávaný výsledek
  { wch: 38 },  // Skutečný výsledek
  { wch: 11 },  // Stav
  { wch: 22 },  // Poznámka
];

XLSX.writeFile(wb, outPath, { cellStyles: true });
console.log('Hotovo:', outPath);
console.log('Celkem testů:', totalRows - 1);
