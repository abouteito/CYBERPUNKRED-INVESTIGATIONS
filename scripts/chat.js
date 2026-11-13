/**
 * Cards de chat do módulo e seus botões.
 */
import { FLAG_CARD, MODULE_ID } from "./constants.js";
import { isShared } from "./mystery-store.js";
import { escapeHTML, loc, tpl } from "./util.js";

const gmIds = () => game.users.filter((u) => u.isGM).map((u) => u.id);

/** Texto do mestre (textarea) → HTML seguro, com links @UUID enriquecidos. */
export async function richText(text) {
  if (!text) return "";
  const html = escapeHTML(text).replace(/\n/g, "<br>");
  return TextEditor.enrichHTML(html);
}

/**
 * Posta um card.
 * @param {object} card
 * @param {string} card.title
 * @param {string} [card.subtitle]
 * @param {{label:string, cls:string}} [card.outcome]
 * @param {{label:string, value:string|number}[]} [card.lines]
 * @param {number|null} [card.bar]       percentual para a barra de Complexidade
 * @param {string} [card.body]           HTML já seguro
 * @param {object[]} [card.buttons]      {action, label, icon, gmOnly, data:{}}
 * @param {Roll[]} [card.rolls]
 * @param {Actor} [card.actor]
 * @param {"public"|"gm"|"gm+user"} [card.audience]
 * @param {User} [card.user]
 * @param {object} [card.flags]
 */
export async function postCard(card) {
  const content = await renderTemplate(tpl("chat-card.hbs"), card);
  const data = {
    content,
    speaker: card.actor ? ChatMessage.getSpeaker({ actor: card.actor }) : ChatMessage.getSpeaker({ alias: loc("CPRINV.Title") }),
    flags: { [MODULE_ID]: { [FLAG_CARD]: card.flags ?? {} } },
  };
  if (card.rolls?.length) {
    data.rolls = card.rolls;
    data.sound = CONFIG.sounds.dice;
  }
  if (card.audience === "gm") data.whisper = gmIds();
  if (card.audience === "gm+user") data.whisper = [...new Set([...gmIds(), card.user?.id ?? game.user.id])];
  return ChatMessage.create(data);
}

/** Público se o mistério está compartilhado com os jogadores; senão só mestre + quem rolou. */
export function audienceFor(journal) {
  return isShared(journal) ? "public" : "gm+user";
}

export function registerChatHooks(handlers) {
  Hooks.on("renderChatMessage", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;
    for (const btn of root.querySelectorAll("[data-cprinv-action]")) {
      if (btn.dataset.gmOnly === "true" && !game.user.isGM) {
        btn.remove();
        continue;
      }
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        const fn = handlers[btn.dataset.cprinvAction];
        if (!fn) return;
        btn.disabled = true;
        try {
          await fn(btn.dataset, message);
        } catch (err) {
          console.error(err);
          ui.notifications.error(err.message);
        } finally {
          btn.disabled = false;
        }
      });
    }
  });
}
