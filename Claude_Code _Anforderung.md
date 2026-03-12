# Anforderung: Multi-Makler Immobiliensuche API für Retell AI Voice Agents

## Kontext

Wir (Sunside AI) bauen KI-Sprachassistenten für Immobilienmakler. Die Voice Agents laufen auf Retell AI und nehmen Anrufe von Interessenten entgegen. Wenn ein Anrufer nach Immobilien fragt, soll der Agent eine Custom Function aufrufen, die den Immobilienbestand des jeweiligen Maklers in Airtable durchsucht und die Ergebnisse als sprechbaren Text zurückgibt.

Der Service muss multi-mandantenfähig sein: Ein Endpoint für alle Makler-Kunden. Jeder Retell Agent schickt eine `client_id` mit, anhand derer der Service die richtige Airtable-Base anspricht.

## Tech Stack

- **Runtime:** Node.js (ES Modules, `"type": "module"` in package.json)
- **Framework:** Express.js
- **Airtable SDK:** `airtable` npm package
- **Deployment:** Railway (hat bereits ein Railway-Konto, der Service bekommt eine eigene Railway-App)
- **Kein Frontend, kein Auth** – der Endpoint wird nur von Retell AI aufgerufen

## Projektstruktur

```
retell-immobilien-api/
├── src/
│   ├── index.js          # Express-Server, Routen
│   ├── config/
│   │   └── clients.js    # Mandanten-Config (client_id → base_id, table, field mapping)
│   ├── services/
│   │   └── airtable.js   # Airtable-Suchlogik, Formula-Builder
│   └── utils/
│       └── response.js   # Sprechbare Antwort-Texte für Retell formatieren
├── package.json
├── .env.example
└── README.md
```

## Airtable-Tabellenstruktur (Referenz: Streil Immobilien)

Die Felder bei unserem ersten Kunden sehen so aus:

| Feldname       | Airtable-Typ   | Inhalt / Beispiel                                           |
|----------------|-----------------|-------------------------------------------------------------|
| Titel          | Single line     | „Fertiger Neubau in Oberndorf a. Neckar, Investment in..." |
| Kategorie      | Single select   | „Kaufen" oder „Mieten"                                      |
| Standort       | Single line     | „78727 Oberndorf" (PLZ + Ort in einem Feld)                |
| Preis          | Currency (€)    | 425000 (als Zahl)                                           |
| Beschreibung   | Long text       | Freitext mit Objektdetails, beginnt mit „=== OBJEKTDATEN ===" – enthält Infos wie Zimmeranzahl, Fläche, Ausstattung etc. als Fließtext |
| Objektnummer   | Single line     | „HP808"                                                     |
| Bild           | URL             | Link zu onoffice Bild-CDN                                   |
| Webseite       | URL             | Link zur Objektdetailseite beim Makler                      |

**Wichtig:** Es gibt KEIN separates Feld für Zimmer, Fläche oder Ausstattung. Diese Infos stecken im Beschreibungsfeld. Die Suche muss daher per Freitext (`FIND()`) in Titel + Beschreibung arbeiten.

Andere Makler haben möglicherweise leicht andere Feldnamen. Deshalb braucht die Config ein optionales Field-Mapping pro Mandant.

## Mandanten-Config

```js
// src/config/clients.js
// Jeder Mandant hat: baseId, table, und optionales fields-Mapping

export const CLIENTS = {
  streil: {
    baseId: process.env.AT_BASE_STREIL,
    table: "Table 1",
    // Standardfelder, kein Mapping nötig
  },
  // Beispiel für Makler mit abweichenden Feldnamen:
  // heyen: {
  //   baseId: process.env.AT_BASE_HEYEN,
  //   table: "Objekte",
  //   fields: {
  //     Titel: "Objekttitel",
  //     Standort: "Adresse",
  //     Preis: "Kaufpreis",
  //     Kategorie: "Art",
  //     Beschreibung: "Details",
  //   },
  // },
};
```

Feld-Auflösung: Wenn `client.fields?.Titel` existiert, nutze diesen Feldnamen. Sonst Fallback auf den Standardnamen „Titel".

## API-Endpoint

### `POST /search`

**Request Body** (kommt von Retell Custom Function):

```json
{
  "args": {
    "client_id": "streil",
    "kategorie": "Kaufen",
    "standort": "Oberndorf",
    "max_preis": "300000",
    "suchbegriff": "Einfamilienhaus"
  }
}
```

Alle Parameter außer `client_id` sind optional. Retell sendet die Function-Parameter im `args`-Objekt, aber manche Versionen senden sie auch direkt im Body → beides unterstützen: `const args = req.body.args || req.body`.

**Suchlogik (Airtable `filterByFormula`):**

1. `kategorie` → exakter Match auf Feld Kategorie: `LOWER({Kategorie}) = LOWER("Kaufen")`
2. `standort` → Teilstring-Suche in Standort-Feld: `FIND(LOWER("oberndorf"), LOWER({Standort}))` — damit matcht sowohl „Oberndorf" als auch „78727 Oberndorf"
3. `max_preis` → numerischer Vergleich: `{Preis} <= 300000`
4. `suchbegriff` → Freitext in Titel ODER Beschreibung: `OR(FIND(LOWER("einfamilienhaus"), LOWER({Titel})), FIND(LOWER("einfamilienhaus"), LOWER({Beschreibung})))`

Mehrere Bedingungen mit `AND()` verknüpfen. Keine Bedingungen = alle Objekte zurückgeben (maxRecords greift).

**Airtable-Query:**
- `maxRecords: 5`
- `sort: [{ field: "Preis", direction: "asc" }]`
- Sortier-Feld muss auch über das Field-Mapping aufgelöst werden

**Response** (Retell erwartet ein `result`-String):

Bei Treffern:
```json
{
  "result": "Ich habe 3 passende Objekte gefunden: 1. Fertiger Neubau in Oberndorf a. Neckar in 78727 Oberndorf, Kaufpreis: 425.000 Euro. 2. Charmantes Einfamilienhaus... Soll ich zu einem dieser Objekte einen Besichtigungstermin vorschlagen?"
}
```

Bei keinen Treffern:
```json
{
  "result": "Leider habe ich aktuell kein passendes Objekt gefunden. Ich notiere gerne Ihre Wünsche – ein Kollege meldet sich, sobald etwas Passendes reinkommt."
}
```

Bei Fehler (Airtable nicht erreichbar, ungültige client_id etc.):
```json
{
  "result": "Die Objektsuche ist gerade leider nicht verfügbar. Darf ich Ihre Kontaktdaten aufnehmen? Ein Kollege ruft Sie zurück."
}
```

**Formatierung der Ergebnisse:**
- Preise mit deutschem Tausenderformat: `425.000 Euro` (kein €-Zeichen, wird vorgelesen)
- Bei Kategorie „Mieten" → „Miete: X Euro", bei „Kaufen" → „Kaufpreis: X Euro"
- Maximal 3 Objekte in der Antwort, auch wenn 5 zurückkommen (am Telefon überfordert mehr)
- Objektnummer NICHT nennen (ist intern)
- Bild-URL und Webseite-URL NICHT vorlesen

### `GET /health`

Einfacher Health-Check für Railway:
```json
{ "status": "ok" }
```

## Environment Variables

```env
# Airtable Personal Access Token (einer für alle Bases)
AIRTABLE_PAT=patXXXXXXXXXXXXXX

# Pro Makler eine Base-ID
AT_BASE_STREIL=appXXXXXXXXXXXXXX

# Server
PORT=3000
```

`.env.example` mit allen Variablen anlegen (ohne echte Werte).

## Error Handling

- Unbekannte `client_id` → freundliche Fehlermeldung als `result` zurückgeben, kein 4xx-Status (Retell versteht nur das result-Feld)
- Airtable API-Fehler → try/catch, Fallback-Meldung als `result`
- Fehlende Environment Variable → beim Start loggen, nicht crashen
- **Immer HTTP 200 zurückgeben** — Retell interpretiert non-200 als Timeout. Fehler werden über den `result`-String kommuniziert.

## Qualitätsanforderungen

- Saubere Trennung: Config, Suchlogik, Response-Formatierung in eigene Dateien
- Alle String-Literale die der Anrufer hört auf Deutsch
- Console.log bei Fehlern mit genug Kontext zum Debuggen
- Keine hardcodierten Base-IDs oder Feldnamen im Hauptcode
- Code-Kommentare auf Deutsch

## README.md

Soll enthalten:
1. Kurzbeschreibung (was macht der Service)
2. Voraussetzungen (Node.js, Airtable PAT, Railway)
3. Lokales Setup (`npm install`, `.env` anlegen, `npm run dev`)
4. Deployment auf Railway
5. Neuen Makler onboarden (Schritt-für-Schritt)
6. Testen mit curl-Beispielen (mindestens 3 verschiedene Suchanfragen)
7. Retell-Konfiguration: Custom Function Name, Parameter, Prompt-Abschnitt

## package.json Scripts

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js"
  }
}
```

## Nicht im Scope

- Kein Auth/API-Key-Validation (kommt später)
- Keine Terminbuchung (separater Service)
- Kein Frontend/Dashboard
- Keine Datenbank – Config bleibt im Code
