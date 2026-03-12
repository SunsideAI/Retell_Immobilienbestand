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

  // Kategorie: exakter Match (Groß-/Kleinschreibung ignorieren)
  if (args.kategorie) {
    const kat = args.kategorie.toLowerCase().replace(/"/g, "");
    conditions.push(`LOWER({${fKategorie}}) = LOWER("${kat}")`);
  }

  // Standort: Teilstring-Suche (matcht PLZ + Ort in einem Feld)
  if (args.standort) {
    const ort = args.standort.toLowerCase().replace(/"/g, "");
    conditions.push(`FIND(LOWER("${ort}"), LOWER({${fStandort}}))`);
  }

  // Maximalpreis: numerischer Vergleich
  if (args.max_preis) {
    const preis = parseFloat(args.max_preis);
    if (!isNaN(preis)) {
      conditions.push(`{${fPreis}} <= ${preis}`);
    }
  }

  // Suchbegriff: Freitext in Titel, Kurzbeschreibung ODER Beschreibung
  if (args.suchbegriff) {
    const begriff = args.suchbegriff.toLowerCase().replace(/"/g, "");
    conditions.push(
      `OR(FIND(LOWER("${begriff}"), LOWER({${fTitel}})), FIND(LOWER("${begriff}"), LOWER({${fKurzbeschreibung}})), FIND(LOWER("${begriff}"), LOWER({${fBeschreibung}})))`
    );
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
