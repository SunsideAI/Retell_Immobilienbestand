// Mandanten-Konfiguration: client_id → Airtable-Base-ID, Tabelle, optionales Feldmapping
// Jeder Eintrag entspricht einem Makler-Kunden.

export const CLIENTS = {
  streil: {
    baseId: process.env.AT_BASE_STREIL,
    table: "Table 1",
    // Keine fields-Angabe → Standardfeldnamen werden verwendet
  },

  // Beispiel für einen Makler mit abweichenden Feldnamen:
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

/**
 * Gibt den tatsächlichen Feldnamen in Airtable zurück.
 * Wenn ein Mandant eigene Feldnamen konfiguriert hat, wird der gemappte Name genutzt.
 * Ansonsten Fallback auf den Standard-Feldnamen.
 *
 * @param {object} client - Mandanten-Config-Objekt
 * @param {string} standardName - Standard-Feldname (z.B. "Titel", "Preis")
 * @returns {string}
 */
export function resolveField(client, standardName) {
  return client.fields?.[standardName] ?? standardName;
}
