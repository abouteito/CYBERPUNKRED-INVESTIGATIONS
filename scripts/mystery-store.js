/**
 * Mistérios ficam guardados como JournalEntry com os dados em flags.
 * Assim podem ser compartilhados (permissão de Observador), exportados e importados de compêndio.
 */
import { COMPLEXITY, FLAG_MYSTERY, MODULE_ID, SHEET_CLASS_ID } from "./constants.js";
import { dayIndex, normalizeClue, normalizeHint, normalizeMystery, normalizeObstacle } from "./rules.js";
import { getSetting } from "./settings.js";
import { newId } from "./util.js";

export function isMystery(journal) {
  return Boolean(journal?.getFlag?.(MODULE_ID, FLAG_MYSTERY));
}

export function getMystery(journal) {
  return normalizeMystery(journal?.getFlag(MODULE_ID, FLAG_MYSTERY), newId);
}

export async function saveMystery(journal, data) {
  const clean = normalizeMystery(data, newId);
  await journal.update({ [`flags.${MODULE_ID}.${FLAG_MYSTERY}`]: clean });
  return clean;
}

/** Aplica uma alteração ao mistério: fn recebe uma cópia e a modifica. */
export async function mutateMystery(journal, fn) {
  const data = foundry.utils.deepClone(getMystery(journal));
  const out = await fn(data);
  return saveMystery(journal, out ?? data);
}

export function listMysteries() {
  return game.journal.filter((j) => isMystery(j) && j.visible);
}

export function isShared(journal) {
  return (journal.ownership?.default ?? 0) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
}

export async function setShared(journal, shared) {
  const level = shared ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
  await journal.update({ "ownership.default": level });
}

export async function createMystery({ name, difficulty = "average", folder = null } = {}) {
  const max = COMPLEXITY[difficulty] ?? COMPLEXITY.average;
  const data = normalizeMystery({ difficulty, complexity: { max, value: max } }, newId);
  return JournalEntry.create({
    name: name || game.i18n.localize("CPRINV.Mystery.NewName"),
    folder,
    flags: {
      [MODULE_ID]: { [FLAG_MYSTERY]: data },
      core: { sheetClass: SHEET_CLASS_ID },
    },
  });
}

export const newClue = (data = {}) => normalizeClue(data, newId);
export const newObstacle = (data = {}) => normalizeObstacle(data, newId);
export const newHint = (data = {}) => normalizeHint(data, newId);

export function currentDay() {
  return dayIndex(game.time.worldTime, getSetting("dayOffset"), getSetting("useWorldTime"));
}
