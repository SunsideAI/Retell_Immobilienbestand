import { resolveField } from "../config/clients.js";

/**
 * Formatiert einen Preis als deutschen Tausender-String ohne €-Zeichen.
 * Retell liest den Text vor – "Euro" klingt besser als "€".
 *
 * @param {number} preis
 * @returns {string} z.B. "425.000 Euro"
 */
function formatPreis(preis) {
  if (!preis && preis !== 0) return "Preis auf Anfrage";
  return preis.toLocaleString("de-DE") + " Euro";
}

/**
 * Baut den Preis-Teil einer Objektbeschreibung je nach Kategorie.
 *
 * @param {string} kategorie - "Kaufen" oder "Mieten"
 * @param {number} preis
 * @returns {string}
 */
function formatPreisMitLabel(kategorie, preis) {
  const label =
    kategorie?.toLowerCase() === "mieten" ? "Miete" : "Kaufpreis";
  return `${label}: ${formatPreis(preis)}`;
}

/**
 * Wandelt die Airtable-Records in einen sprechbaren Antwort-String um.
 * Maximal 3 Objekte werden genannt (am Telefon überfordert mehr).
 * Objektnummern, Bild-URLs und Webseiten-URLs werden NICHT vorgelesen.
 *
 * @param {object[]} records - Airtable-Records
 * @param {object} client - Mandanten-Config für Feldmapping
 * @returns {string} Fertige result-Antwort für Retell
 */
export function formatProperties(records, client) {
  // Maximal 3 Objekte ansagen
  const top3 = records.slice(0, 3);

  const fTitel = resolveField(client, "Titel");
  const fStandort = resolveField(client, "Standort");
  const fPreis = resolveField(client, "Preis");
  const fKategorie = resolveField(client, "Kategorie");
  const fKurzbeschreibung = resolveField(client, "Kurzbeschreibung");

  const liste = top3.map((record, index) => {
    const felder = record.fields;
    const titel = felder[fTitel] ?? "Objekt ohne Titel";
    const standort = felder[fStandort] ?? "Standort unbekannt";
    const preis = felder[fPreis];
    const kategorie = felder[fKategorie];
    const kurzbeschreibung = felder[fKurzbeschreibung];

    const preisText = formatPreisMitLabel(kategorie, preis);
    const kurzText = kurzbeschreibung ? ` ${kurzbeschreibung}` : "";
    return `${index + 1}. ${titel} in ${standort}, ${preisText}.${kurzText}`;
  });

  const anzahl = top3.length;
  const intro =
    anzahl === 1
      ? "Ich habe ein passendes Objekt gefunden:"
      : `Ich habe ${anzahl} passende Objekte gefunden:`;

  return `${intro} ${liste.join(" ")} Soll ich zu einem dieser Objekte einen Besichtigungstermin vorschlagen?`;
}

/**
 * Antwort wenn keine passenden Objekte gefunden wurden.
 *
 * @returns {string}
 */
export function noResults() {
  return "Leider habe ich aktuell kein passendes Objekt gefunden. Ich notiere gerne Ihre Wünsche – ein Kollege meldet sich, sobald etwas Passendes reinkommt.";
}

/**
 * Antwort bei technischen Fehlern (Airtable nicht erreichbar, Konfigurationsproblem).
 *
 * @returns {string}
 */
export function errorResult() {
  return "Die Objektsuche ist gerade leider nicht verfügbar. Darf ich Ihre Kontaktdaten aufnehmen? Ein Kollege ruft Sie zurück.";
}
