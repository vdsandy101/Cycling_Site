# Cycling DB Dashboard (standalone)

Deze map is volledig los van je andere projecten en bedoeld om apart te publiceren op GitHub en te deployen op Vercel.

## Wat je ziet in de UI

- Totale entries over je belangrijkste MongoDB-collecties
- Laatst toegevoegde/geüpdatete entry (op basis van `updated_at`)

## Lokaal draaien

1. Installeer dependencies:

```powershell
npm install
```

2. Maak env-file:

```powershell
copy .env.example .env.local
```

3. Vul je echte MongoDB gegevens in `.env.local`.

4. Start:

```powershell
npm run dev
```

## Apart publiceren op GitHub

Voer deze commando's uit in deze map:

```powershell
cd e:\02.work\02.VscodePorjects\cycling-dashboard-vercel
git init
git add .
git commit -m "Initial standalone cycling dashboard"
git branch -M main
git remote add origin <jouw-github-repo-url>
git push -u origin main
```

## Vercel deploy

- Import je GitHub repo in Vercel
- Framework: Next.js (automatisch)
- Build command: `npm run build` (standaard)
- Voeg environment variables toe uit `.env.example`
- Deploy

## API

- `GET /api/stats`
- response bevat `totalEntries`, `latestEntry`, `checkedCollections`
