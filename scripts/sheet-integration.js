/**
 * Mostra o Foco nas fichas de personagem e de NPC (mook) do sistema.
 * As fichas do CPR 0.92.4 são Application v1, então o hook entrega jQuery.
 */
import { getFocus, isFocusActor } from "./focus.js";
import * as Checks from "./checks.js";
import { showFocusLog } from "./dialogs.js";
import { tpl } from "./util.js";

/**
 * Linha compartilhada no topo do painel de baixo da ficha de personagem (acima de Role / Fight / Lifepath).
 * A coluna da esquerda tem altura fixa (34rem) e já está cheia: qualquer coisa a mais ali empurra os
 * atributos para baixo do painel de baixo. Os módulos cpr-investigation e cpr-edgerunners-2070s usam a
 * mesma linha (mesma classe e CSS), então os dois cabem juntos.
 * Chamar depois de qualquer await, para não criar duas linhas.
 */
function addonRow(root) {
  const bottom = root.querySelector(".actor-sheet .bottom-pane");
  if (!bottom) return null;
  let row = bottom.querySelector(":scope > .cpr-addon-row");
  if (!row) {
    row = document.createElement("div");
    row.className = "cpr-addon-row";
    bottom.prepend(row);
    bottom.classList.add("cpr-has-addon-row");
  }
  return row;
}

async function injectFocus(app, html) {
  const actor = app.actor ?? app.document;
  if (!isFocusActor(actor)) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  // Personagem: linha no topo do painel de baixo. Mook: área de atributos.
  const character = Boolean(root.querySelector(".actor-sheet .bottom-pane"));
  if (!character && !root.querySelector(".mook-stats-and-derived")) return;

  const focus = getFocus(actor);
  const content = await renderTemplate(tpl("focus-widget.hbs"), {
    value: focus.value,
    max: focus.max,
    pct: Math.round((focus.value / focus.max) * 100),
    zero: focus.value <= 0,
    owner: actor.isOwner,
    mook: !character,
  });
  const wrapper = document.createElement("div");
  wrapper.innerHTML = content.trim();
  const widget = wrapper.firstElementChild;
  root.querySelectorAll(".cprinv-focus").forEach((el) => el.remove());
  const row = addonRow(root);
  if (row) row.appendChild(widget);
  else root.querySelector(".mook-stats-and-derived")?.appendChild(widget);

  widget.querySelector('[data-cprinv="rest"]')?.addEventListener("click", (ev) => {
    ev.preventDefault();
    Checks.rest(actor);
  });
  widget.querySelector('[data-cprinv="adjust"]')?.addEventListener("click", (ev) => {
    ev.preventDefault();
    Checks.adjustFocus(actor);
  });
  widget.querySelector('[data-cprinv="log"]')?.addEventListener("click", (ev) => {
    ev.preventDefault();
    showFocusLog(actor);
  });
}

export function registerSheetHooks() {
  Hooks.on("renderActorSheet", (app, html) => {
    injectFocus(app, html).catch((err) => console.error("cpr-investigation | Foco na ficha", err));
  });
}
