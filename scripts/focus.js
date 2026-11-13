/**
 * Foco: atributo derivado novo, guardado nas flags do ator (o sistema não é alterado).
 */
import { FLAG_FOCUS, FOCUS_LOG_MAX, MODULE_ID } from "./constants.js";
import { clamp, focusMax } from "./rules.js";
import { getSetting } from "./settings.js";
import { stat } from "./cpr-adapter.js";

export function isFocusActor(actor) {
  if (!actor) return false;
  if (actor.type === "character") return true;
  if (actor.type === "mook") return getSetting("mookFocus");
  return false;
}

export function getFocusMax(actor) {
  return focusMax(stat(actor, "int"), stat(actor, "will"));
}

export function getFocus(actor) {
  const data = actor.getFlag(MODULE_ID, FLAG_FOCUS) ?? {};
  const max = getFocusMax(actor);
  const raw = Number.isFinite(Number(data.value)) && data.value !== null ? Number(data.value) : max;
  return {
    value: clamp(raw, 0, max),
    max,
    log: Array.isArray(data.log) ? data.log : [],
  };
}

/**
 * Define o Foco e registra no histórico.
 * @returns {Promise<{old:number, value:number, max:number, delta:number}>}
 */
export async function setFocus(actor, newValue, reason = "") {
  const { value: old, max, log } = getFocus(actor);
  const value = clamp(Math.round(Number(newValue) || 0), 0, max);
  const entry = {
    time: Date.now(),
    from: old,
    to: value,
    reason: String(reason ?? ""),
    user: game.user.name,
  };
  const newLog = [...log, entry].slice(-FOCUS_LOG_MAX);
  await actor.update({ [`flags.${MODULE_ID}.${FLAG_FOCUS}`]: { value, log: newLog } });
  return { old, value, max, delta: value - old };
}

export async function modifyFocus(actor, delta, reason = "") {
  const { value } = getFocus(actor);
  return setFocus(actor, value + Number(delta || 0), reason);
}

export async function clearFocusLog(actor) {
  const { value } = getFocus(actor);
  await actor.update({ [`flags.${MODULE_ID}.${FLAG_FOCUS}`]: { value, log: [] } });
}
