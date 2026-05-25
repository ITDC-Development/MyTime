#!/bin/bash
# Spustí Firebase Emulator Suite + naseeduje data + nastartuje backend a frontend.
# Vyžaduje: firebase-tools, Java 17+, Node 20+, npm 10+

set -e

echo "==> Instaluji závislosti..."
npm install
(cd frontend && npm install)
(cd backend && npm install)

echo "==> Kopíruji .env soubory, pokud chybí..."
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
[ -f backend/.env ] || cp backend/.env.example backend/.env

echo ""
echo "==> Otevři tři terminály a spusť:"
echo "    1) firebase emulators:start"
echo "    2) cd backend && npm run seed"
echo "    3) cd backend && npm run dev"
echo "    4) cd frontend && npm run dev"
echo ""
echo "Pak otevři http://localhost:5173"
