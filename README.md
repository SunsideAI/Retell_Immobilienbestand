# Retell Immobilien API

Multi-Makler Immobiliensuche API für Retell AI Voice Agents. Der Service nimmt Suchanfragen von KI-Sprachassistenten entgegen, durchsucht den Airtable-Immobilienbestand des jeweiligen Maklers und gibt die Ergebnisse als sprechbaren Text zurück.

## Voraussetzungen

- **Node.js** ≥ 18 (wegen `--watch` und ES Modules)
- **Airtable Personal Access Token** mit Lesezugriff auf die Bases der Makler
- **Railway**-Konto für das Deployment

## Lokales Setup

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen anlegen
cp .env.example .env
# .env öffnen und echte Werte eintragen

# 3. Entwicklungsserver starten (mit Auto-Reload)
npm run dev
```

## Deployment auf Railway

1. Neues Projekt in Railway anlegen → "Deploy from GitHub repo"
2. Repository verbinden
3. Umgebungsvariablen in Railway eintragen (Settings → Variables):
   - `AT_TOKEN_STREIL`
   - `AT_BASE_STREIL` (und weitere Makler-Bases)
4. Railway erkennt `npm start` automatisch aus `package.json`
5. Nach dem Deploy: Health-Check testen
   ```bash
   curl https://IHRE-RAILWAY-URL/health
   ```

## Neuen Makler onboarden

1. **Airtable Base-ID** des neuen Maklers ermitteln (URL: `airtable.com/appXXXXXXXXX/...`)
2. **Umgebungsvariable** hinzufügen, z.B. `AT_BASE_MUSTER=appXXXXXXXXXXXXXX`
3. **clients.js** erweitern:
   ```js
   // src/config/clients.js
   muster: {
     baseId: process.env.AT_BASE_MUSTER,
     table: "Objekte",           // Exakter Tabellenname in Airtable
     // fields nur angeben wenn Feldnamen abweichen:
     // fields: {
     //   Titel: "Objekttitel",
     //   Standort: "Adresse",
     //   Preis: "Kaufpreis",
     //   Kategorie: "Art",
     //   Beschreibung: "Details",
     // },
   },
   ```
4. In Railway die neue Umgebungsvariable eintragen und neu deployen
5. Mit curl testen (siehe unten)

**Standard-Feldnamen** (kein Mapping nötig wenn diese Feldnamen in Airtable verwendet werden):
| Logischer Name | Standard-Feldname |
|---|---|
| Titel | `Titel` |
| Standort | `Standort` |
| Preis | `Preis` |
| Kategorie | `Kategorie` |
| Beschreibung | `Beschreibung` |

## Testen mit curl

### Health-Check
```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

### Suche mit allen Parametern
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{
    "args": {
      "client_id": "streil",
      "kategorie": "Kaufen",
      "standort": "Oberndorf",
      "max_preis": "500000",
      "suchbegriff": "Einfamilienhaus"
    }
  }'
```

### Nur nach Kategorie und Standort suchen
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{
    "args": {
      "client_id": "streil",
      "kategorie": "Mieten",
      "standort": "Stuttgart"
    }
  }'
```

### Suche ohne Filter (alle Objekte)
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"args": {"client_id": "streil"}}'
```

### Retell-Format ohne args-Wrapper (beide Varianten werden unterstützt)
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"client_id": "streil", "kategorie": "Kaufen", "max_preis": "300000"}'
```

### Ungültige client_id (gibt freundliche Fehlermeldung zurück)
```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"args": {"client_id": "unbekannt"}}'
```

## Retell-Konfiguration

### Custom Function anlegen

| Einstellung | Wert |
|---|---|
| Function Name | `search_properties` |
| URL | `https://IHRE-RAILWAY-URL/search` |
| Method | `POST` |

### Parameter

| Name | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `client_id` | string | ja | Makler-ID (z.B. `"streil"`) |
| `kategorie` | string | nein | `"Kaufen"` oder `"Mieten"` |
| `standort` | string | nein | Ort oder PLZ (Teilstring-Suche) |
| `max_preis` | string | nein | Maximaler Preis als Zahl-String |
| `suchbegriff` | string | nein | Freitext (wird in Titel + Beschreibung gesucht) |

### Prompt-Abschnitt für den Voice Agent

```
Du hast Zugriff auf die Funktion search_properties.
Rufe diese Funktion auf, wenn ein Anrufer nach Immobilien, Wohnungen, Häusern oder
Grundstücken fragt. Übergib dabei immer client_id="{{ CLIENT_ID }}" sowie alle
relevanten Suchkriterien, die der Anrufer genannt hat (Kategorie, Ort, Budget,
Objekttyp). Lies das Ergebnis natürlich vor und frage nach, ob der Anrufer einen
Besichtigungstermin möchte.
```

Ersetze `{{ CLIENT_ID }}` durch die jeweilige Makler-ID (z.B. `streil`).
