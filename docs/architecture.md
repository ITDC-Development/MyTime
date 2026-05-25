# Architektura MyTime

## Diagram

```
┌──────────────────────┐         ┌──────────────────────┐
│   Frontend (Vite)    │         │  Backend (Cloud Run) │
│  React + TS + MUI    │ ◄──HTTP─┤  Node.js + Express   │
│  localhost:5173      │  Bearer │  localhost:8081      │
└─────────┬────────────┘         └────────┬─────────────┘
          │                                │
          ▼                                ▼
    ┌────────────────────────────────────────────┐
    │            Firebase Emulator               │
    │   Auth :9099 / Firestore :8080 / UI :4000  │
    └────────────────────────────────────────────┘
                       ▲
                       │
              ┌────────┴────────┐
              │  Jira REST API  │
              │  Activity TL    │
              └─────────────────┘
```

## Vrstvy

- **Frontend (React + TS + MUI)** komunikuje s Firestore přímo přes Firebase SDK (čtení/zápis worklogů,
  profilů, preferencí) a s backendem (Express) pouze pro operace, které potřebují tajemství
  (Jira/Activity Timeline sync, admin operace na uživatelích).

- **Backend (Node.js + Express, Cloud Run)** drží Jira a Activity Timeline credentials, syncuje data,
  vystavuje endpointy `/sync/manual`, `/sync/scheduled` (volaný Cloud Schedulerem), `/users` (CRUD).

- **Firestore** je primární úložiště. Frontend čte/zapisuje přes Firebase SDK, server přes
  Firebase Admin SDK. Bezpečnost je v `firestore.rules`.

## Klíčové toky

### Login
1. Uživatel zadá email + heslo → `signInWithEmailAndPassword` (Firebase Auth)
2. AuthContext načte profil z Firestore `users/{uid}`
3. Podle `status`: `pending`/`blocked` → status screen, `active` → routing podle role

### Linearizace času
1. Frontend si stáhne `worklogs_raw`, `worklogs_edited`, `manual_worklogs` pro výběr (uživatel + měsíc)
2. Pro každého uživatele a den seřadí podle `started`, navazuje od 8:00
3. V 12:00 vloží pauzu 12:00–12:30 (filtrovatelnou přepínačem)
4. Po překročení 8h denně označuje řádky `isOvertime`

### Sync z Jira
1. Manuální (admin): `POST /sync/manual` s rozsahem datumů nebo bez (incremental)
2. Plánovaný: Cloud Scheduler → `POST /sync/scheduled` (OIDC token)
3. Backend přečte `sync_settings` (period), zavolá Jira REST API i Activity Timeline
4. Zkontroluje per-uživatel-měsíc zámky, přeskočí zamknutá období
5. Zapíše `worklogs_raw` + `absences` + záznam do `sync_log`

### Zámky
- Klíč dokumentu: `{year}-{month}-{accountId}`
- Manuální: tlačítko v Menu 2/3 (s confirm modal)
- Automatický: při exportu v Menu 4 (multi-select účtů → multi-lock)
