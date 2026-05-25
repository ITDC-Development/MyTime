# MyTime

Webová aplikace pro vizualizaci pracovní docházky z dat Jira pro IT-DC.

## Funkce

- Stažení worklogů z Jira REST API
- Linearizace na pracovní den 8:00–16:30 s pauzou 12:00–12:30
- Detekce přesčasů nad 8h denně
- Projektový a firemní výkaz s editací (originál + edited verze)
- Přehledy s multi-select uživatelů a exportem CSV/XLSX/PDF
- Audit log všech editací (diff)
- Per-uživatel / per-měsíc zámky (manuální + automatický při exportu)
- Konfigurovatelná frekvence syncu (denně / týdně / měsíčně)
- Integrace s Activity Timeline pluginem pro dovolené
- Role admin / user s self-registrací a admin schválením
- Restrikce přihlášení na firemní domény (@it-dc.cz, @it-dc.sk)

## Tech stack

| Vrstva | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Material UI 5 |
| Backend | Node.js 20 + Express + Firebase Admin SDK |
| Databáze | Firestore (Native mode) |
| Autentizace | Firebase Auth (email/heslo + custom claims pro role) |
| Plánovač | Cloud Scheduler -> backend `/scheduled/sync` |
| Hosting | Firebase Hosting (FE) + Cloud Run (BE) |

## Setup

### Předpoklady

- Node.js 20+
- npm 10+
- Firebase CLI: `npm install -g firebase-tools`
- Java 17+ (pro Firestore Emulator)

### První spuštění

```bash
# 1. Klonování a instalace
git clone <repo>
cd WebAppMyTime
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 2. Konfigurace
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Vyplň hodnoty v .env souborech (viz níže)

# 3. Spuštění Firebase Emulator + naplnění demo daty
firebase emulators:start --import=./emulator-data --export-on-exit
# v jiném terminálu:
cd backend && npm run seed

# 4. Spuštění backendu (nový terminál)
cd backend && npm run dev

# 5. Spuštění frontendu (nový terminál)
cd frontend && npm run dev
```

Aplikace běží na `http://localhost:5173`, backend na `http://localhost:8081`.

### Demo přihlášení

Po spuštění `npm run seed` jsou ve Firestore připravené účty:

- **admin@it-dc.cz** / `admin1234` — admin role, aktivní
- **tomas.kraus@it-dc.cz** / `user1234` — user role, aktivní
- **hana.nova@it-dc.cz** / `user1234` — user role, čekající na schválení

### Environment variables

`frontend/.env`:

```
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-mytime.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-mytime
VITE_FIREBASE_APP_ID=demo-app-id
VITE_API_BASE_URL=http://localhost:8081
VITE_USE_EMULATOR=true
VITE_ALLOWED_EMAIL_DOMAINS=it-dc.cz,it-dc.sk
```

`backend/.env`:

```
PORT=8081
GOOGLE_CLOUD_PROJECT=demo-mytime
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
ALLOWED_EMAIL_DOMAINS=it-dc.cz,it-dc.sk
JIRA_BASE_URL=https://it-dc.atlassian.net
JIRA_EMAIL=
JIRA_API_TOKEN=
ACTIVITY_TIMELINE_BASE_URL=https://it-dc.atlassian.net
ACTIVITY_TIMELINE_AUTH_TOKEN=
USE_MOCK_DATA=true
```

Bez Jira/AT credentials backend automaticky používá mock data (přepínač `USE_MOCK_DATA=true`).

## Struktura

```
WebAppMyTime/
├── frontend/                # React aplikace
│   └── src/
│       ├── pages/           # Stránky (Login, Register, 7 menu položek)
│       ├── components/      # UI komponenty
│       ├── contexts/        # AuthContext
│       ├── hooks/           # Custom hooks
│       ├── services/        # Firebase, Firestore, Export
│       ├── utils/           # linearTime, formátery
│       ├── types/           # TS typy
│       └── i18n/            # CZ texty
│
├── backend/                 # Node.js Cloud Run
│   └── src/
│       ├── routes/          # Express routes
│       ├── services/        # Jira, AT, Worklog sync
│       ├── middleware/      # Auth
│       └── scripts/         # Seed
│
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

## Architektura ve zkratce

Frontend mluví s Firestore přímo (čtení/zápis worklogů, profilů, preferencí) a s backendem
(Express na Cloud Run) jen pro operace, které potřebují tajné klíče (Jira / Activity Timeline
sync, mazání uživatelů). Auth běží přes Firebase Auth s e-mail/heslem omezeným na firemní
domény. Plánovaný sync spouští Cloud Scheduler endpointem na backendu. Linearizace času
(8:00–16:30, pauza 12:00–12:30, přesčas nad 8h) probíhá klientsky.

Per-uživatel-měsíc zámky chrání data před změnou po exportu nebo manuálním zamknutí.

## Demo data

Skript `backend/scripts/seed.ts` vytvoří 4 testovací uživatele a naplní worklogy + absence
pro květen 2026 ze tří fiktivních zaměstnanců (Tomáš Kraus, Hana Nová, Pavel Dvořák) na třech
fiktivních issues z projektu ENBW.

Mock data jsou generována deterministicky každý běh, takže lze opakovaně testovat
linearizaci, pauzy, přesčasy a editaci.

## Testy

MVP zatím nezahrnuje automatizované testy — utility `linearTime`, `pauseRules` a `overtime`
jsou napsané jako čisté funkce, takže přidání Vitest unit testů je přímočaré:

```bash
cd frontend
npm install --save-dev vitest
npx vitest src/utils
```

## Nasazení do Google Cloud

1. **Firebase projekt** — `firebase projects:create mytime-prod`
2. **Firestore** — vytvořit databázi v Native mode, region `europe-west3`
3. **Frontend** — `firebase deploy --only hosting` po `npm run build`
4. **Backend** — `gcloud run deploy mytime-backend --source ./backend --region europe-west3`
5. **Secret Manager** — uložit Jira a Activity Timeline credentials, namountovat do Cloud Run
6. **Cloud Scheduler** — vytvořit job, který každý den / týden / měsíc volá `/sync/scheduled`
   s OIDC tokenem service accountu

## Plánovaný sync

`sync_settings/default` se nastavuje přes UI v Menu 1. Cloud Scheduler v produkci by měl
běžet s vysokou frekvencí (např. každou hodinu) a backend si v `/sync/scheduled` rozhoduje,
jestli má sync skutečně proběhnout (porovnává aktuální čas s `sync_settings`). Alternativně
lze Scheduler nakonfigurovat z UI pomocí Cloud Scheduler Admin API.

## License

Proprietary — IT Delivery Center.
