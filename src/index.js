import "dotenv/config";
import express from "express";
import { CLIENTS } from "./config/clients.js";
import { searchProperties } from "./services/airtable.js";
import { formatProperties, noResults, errorResult } from "./utils/response.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT ?? 3000;

// Beim Start: fehlende Umgebungsvariablen loggen (kein Crash)
if (!process.env.AIRTABLE_PAT) {
  console.warn("[Warnung] AIRTABLE_PAT ist nicht gesetzt. Airtable-Anfragen werden fehlschlagen.");
}

// ---------------------------------------------------------------------------
// GET /health
// Railway Health-Check – gibt immer 200 zurück
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// POST /search
// Retell Custom Function: Immobiliensuche für den angegebenen Makler
// ---------------------------------------------------------------------------
app.post("/search", async (req, res) => {
  // Retell sendet Parameter entweder in args oder direkt im Body
  const args = req.body.args ?? req.body;
  const { client_id, ...suchArgs } = args;

  console.log(`[Search] Anfrage für client_id="${client_id}"`, suchArgs);

  // Unbekannte client_id → freundliche Fehlermeldung, kein 4xx (Retell versteht nur result)
  const client = CLIENTS[client_id];
  if (!client) {
    console.error(`[Search] Unbekannte client_id: "${client_id}"`);
    return res.json({
      result:
        "Es tut mir leid, ich konnte Ihren Makler nicht finden. Bitte wenden Sie sich direkt an unser Büro.",
    });
  }

  // Fehlende Base-ID warnen und mit Fehlermeldung antworten
  if (!client.baseId) {
    console.error(`[Search] Keine baseId für client_id="${client_id}" konfiguriert (Umgebungsvariable fehlt?)`);
    return res.json({ result: errorResult() });
  }

  try {
    const records = await searchProperties(client, suchArgs);

    if (records.length === 0) {
      return res.json({ result: noResults() });
    }

    return res.json({ result: formatProperties(records, client) });
  } catch (err) {
    console.error(`[Search] Fehler bei Airtable-Anfrage für client_id="${client_id}":`, err.message ?? err);
    return res.json({ result: errorResult() });
  }
});

// ---------------------------------------------------------------------------
// Server starten
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[Server] Retell Immobilien API läuft auf Port ${PORT}`);
});
