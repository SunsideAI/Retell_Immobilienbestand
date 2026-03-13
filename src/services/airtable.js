import Airtable from "airtable";
import { resolveField } from "../config/clients.js";

// Airtable-Client mit Personal Access Token initialisieren
const airtable = new Airtable({ apiKey: process.env.AT_TOKEN_STREIL });

/**
 * Baut eine Airtable-Formel aus den übergebenen Suchparametern.
 * Nur übergebene Parameter fließen in die Formel ein.
 *
 * @param {object} client - Mandanten-Config
 * @param {object} args - Suchparameter vom Retell-Agent
 * @returns {string} Airtable filterByFormula-String
 */
function buildFormula(client, args) {
  const conditions = [];

  const fKategorie = resolveField(client, "Kategorie");
  const fStandort = resolveField(client, "Standort");
  const fPreis = resolveField(client, "Preis");
  const fTitel = resolveField(client, "Titel");
  const fBeschreibung = resolveField(client, "Beschreibung");
  const fKurzbeschreibung = resolveField(client, "Kurzbeschreibung");
  const fExposé = resolveField(client, "ExposéNr");

  // Kategorie: exakter Match (Groß-/Kleinschreibung ignorieren)
  if (args.kategorie) {
    const kat = args.kategorie.toLowerCase().replace(/"/g, "");
    conditions.push(`LOWER({${fKategorie}}) = LOWER("${kat}")`);
  }

  // Standort: Wort-für-Wort-Suche (OR) – damit "Lauingen an der Donau" auch "Lauingen" trifft
  if (args.standort) {
    const stopWords = new Set(["an", "am", "im", "in", "der", "die", "das", "bei", "von", "und"]);
    const ortWoerter = args.standort
      .toLowerCase()
      .replace(/"/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    if (ortWoerter.length > 0) {
      const ortBedingungen = ortWoerter.map(w => `FIND(LOWER("${w}"), LOWER({${fStandort}}))`);
      conditions.push(ortBedingungen.length === 1 ? ortBedingungen[0] : `OR(${ortBedingungen.join(", ")})`);
    }
  }

  // Maximalpreis: numerischer Vergleich
  if (args.max_preis) {
    const preis = parseFloat(args.max_preis);
    if (!isNaN(preis)) {
      conditions.push(`{${fPreis}} <= ${preis}`);
    }
  }

  // Suchbegriff: Jedes Wort einzeln suchen (OR), damit "vier Zimmer" auch "4-Zimmer" trifft
  if (args.suchbegriff) {
    const zahlwoerter = { "ein": "1", "zwei": "2", "drei": "3", "vier": "4", "fünf": "5",
      "sechs": "6", "sieben": "7", "acht": "8", "neun": "9", "zehn": "10" };

    // Begriffe normalisieren: Zahlwörter durch Ziffern ergänzen
    const roherBegriff = args.suchbegriff.toLowerCase().replace(/"/g, "");
    const woerter = new Set(roherBegriff.split(/\s+/).filter(w => w.length > 2));
    for (const [wort, ziffer] of Object.entries(zahlwoerter)) {
      if (roherBegriff.includes(wort)) woerter.add(ziffer);
    }

    const suchBedingungen = [];
    for (const wort of woerter) {
      const w = wort.replace(/"/g, "");
      suchBedingungen.push(`FIND(LOWER("${w}"), LOWER({${fTitel}}))`);
      suchBedingungen.push(`FIND(LOWER("${w}"), LOWER({${fKurzbeschreibung}}))`);
      suchBedingungen.push(`FIND(LOWER("${w}"), LOWER({${fBeschreibung}}))`);
      suchBedingungen.push(`FIND(LOWER("${w}"), LOWER({${fExposé}}))`);
    }

    if (suchBedingungen.length > 0) {
      conditions.push(`OR(${suchBedingungen.join(", ")})`);
    }
  }

  // Mehrere Bedingungen mit AND() verknüpfen, sonst keine Formel (alle Objekte)
  if (conditions.length === 0) return "";
  if (conditions.length === 1) return conditions[0];
  return `AND(${conditions.join(", ")})`;
}

/**
 * Sucht Objekte in der Airtable-Base des Mandanten.
 *
 * @param {object} client - Mandanten-Config (baseId, table, fields)
 * @param {object} args - Suchparameter (kategorie, standort, max_preis, suchbegriff)
 * @returns {Promise<object[]>} Array der gefundenen Records
 */
export async function searchProperties(client, args) {
  const base = airtable.base(client.baseId);
  const formula = buildFormula(client, args);
  const sortField = resolveField(client, "Preis");

  const queryOptions = {
    maxRecords: 5,
    sort: [{ field: sortField, direction: "asc" }],
  };

  if (formula) {
    queryOptions.filterByFormula = formula;
  }

  console.log(`[Airtable] Suche in Base ${client.baseId}, Tabelle "${client.table}"`);
  console.log(`[Airtable] Formel: ${formula || "(keine – alle Objekte)"}`);

  const records = await base(client.table).select(queryOptions).all();

  console.log(`[Airtable] ${records.length} Ergebnis(se) gefunden`);
  return records;
}
