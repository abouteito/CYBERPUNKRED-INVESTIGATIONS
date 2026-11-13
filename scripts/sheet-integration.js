/**
 * Mostra o Foco nas fichas de personagem e de NPC (mook) do sistema.
 * As fichas do CPR 0.92.4 são Application v1, então o hook entrega jQuery.
 */
import { getFocus, isFocusActor } from "./focus.js";
import * as Checks from "./checks.js";
import { showFocusLog } from "./dialogs.js";
import { tpl } from "./util.js";

async function injectFocus(app, html) {
  const actor = app.actor ?? app.document;
  if (!isFocusActor(actor)) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  root.querySelector(".cprinv-focus")?.remove();

  // Personagem: bloco de detalhes da coluna esquerda. Mook: área de atributos.
  const characterAnchor = root.querySelector(".left-pane .actor-details");
  const mookAnchor = root.querySelector(".mook-stats-and-derived");
  const anchor = characterAnchor ?? mookAnchor;
  if (!anchor) return;

  const focus = getFocus(actor);
  const content = await renderTemplate(tpl("focus-widget.hbs"), {
    value: focus.value,
    max: focus.max,
    pct: Math.round((focus.value / focus.max) * 100),
    zero: focus.value <= 0,
    owner: actor.isOwner,
    mook: !characterAnchor,
  });
  const wrapper = document.createElement("div");
  wrapper.innerHTML = content.trim();
  const widget = wrapper.firstElementChild;
  anchor.appendChild(widget);

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
