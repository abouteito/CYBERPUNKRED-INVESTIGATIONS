import { MODULE_ID, TEMPLATE_PATH } from "./constants.js";

export const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export const tpl = (name) => `${TEMPLATE_PATH}/${name}`;

export const newId = () => foundry.utils.randomID(16);

export const escapeHTML = (text) =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Rola uma fórmula com segurança; fórmula inválida vira 0. */
export async function safeRoll(formula) {
  const f = String(formula ?? "").trim() || "0";
  const valid = Roll.validate(f);
  const roll = new Roll(valid ? f : "0");
  await roll.evaluate();
  return roll;
}

export function notify(type, key, data) {
  ui.notifications?.[type]?.(loc(key, data));
}

export const isGM = () => game.user.isGM;

export function moduleApi() {
  return game.modules.get(MODULE_ID)?.api;
}
