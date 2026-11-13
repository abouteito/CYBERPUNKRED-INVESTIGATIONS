/**
 * Did Someone Say Murder? — Sistema de Investigação para Cyberpunk RED - CORE (Foundry v12).
 */
import { MODULE_ID, SYSTEM_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { InvSocket } from "./socket.js";
import { initAdapter } from "./cpr-adapter.js";
import * as Focus from "./focus.js";
import * as Store from "./mystery-store.js";
import * as Checks from "./checks.js";
import { registerChatHooks } from "./chat.js";
import { registerSheetHooks } from "./sheet-integration.js";
import { registerJournalHooks, registerJournalSheet } from "./journal-integration.js";
import { MysteryApp } from "./apps/mystery-app.js";
import { MysteryBrowser } from "./apps/mystery-browser.js";
import { loc, tpl } from "./util.js";

Hooks.once("init", () => {
  registerSettings();
  if (game.system.id !== SYSTEM_ID) return;

  loadTemplates([
    tpl("mystery-app.hbs"),
    tpl("mystery-browser.hbs"),
    tpl("entry-editor.hbs"),
    tpl("focus-widget.hbs"),
    tpl("chat-card.hbs"),
    tpl("dialog-skill.hbs"),
  ]);

  registerJournalSheet();
  registerJournalHooks();
  registerSheetHooks();
  registerChatHooks(Checks.chatHandlers);

  Hooks.on("updateActor", (actor, changes) => {
    const focusChanged = foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`);
    const statsChanged = foundry.utils.hasProperty(changes, "system.stats");
    if (focusChanged || statsChanged) MysteryApp.refreshAll();
  });

  game.modules.get(MODULE_ID).api = {
    openMysteries: () => MysteryBrowser.open(),
    openMystery: (journalOrId) => {
      const journal = typeof journalOrId === "string" ? game.journal.get(journalOrId) ?? game.journal.getName(journalOrId) : journalOrId;
      return MysteryApp.open(journal);
    },
    createMystery: Store.createMystery,
    getMystery: Store.getMystery,
    isMystery: Store.isMystery,
    currentDay: Store.currentDay,
    newDay: Checks.newDay,
    getFocus: Focus.getFocus,
    getFocusMax: Focus.getFocusMax,
    setFocus: Focus.setFocus,
    modifyFocus: Focus.modifyFocus,
    rest: Checks.rest,
    evidenceCheck: Checks.evidenceCheck,
    askHint: Checks.askHint,
    apps: { MysteryApp, MysteryBrowser },
  };
});

Hooks.once("ready", async () => {
  if (game.system.id !== SYSTEM_ID) {
    if (game.user.isGM) ui.notifications.warn(loc("CPRINV.Error.WrongSystem"));
    return;
  }
  const ok = await initAdapter();
  if (!ok && game.user.isGM) ui.notifications.error(loc("CPRINV.Error.AdapterFailed"));
  InvSocket.init();
  Checks.registerSocketHandlers();
});
