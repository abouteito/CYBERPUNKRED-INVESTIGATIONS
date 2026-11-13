/**
 * Integração com o diário: mistério abre o painel próprio, botão "Mistérios" e menu de contexto.
 */
import { MODULE_ID, SHEET_CLASS_NAME } from "./constants.js";
import { isMystery } from "./mystery-store.js";
import { MysteryApp } from "./apps/mystery-app.js";
import { MysteryBrowser } from "./apps/mystery-browser.js";
import { loc } from "./util.js";

export function registerJournalSheet() {
  // "Ficha" de JournalEntry que, em vez de abrir o diário, abre o painel do mistério.
  const MysteryJournalSheet = {
    [SHEET_CLASS_NAME]: class extends JournalSheet {
      render() {
        const doc = this.document;
        if (!doc) return this;
        // Dentro do compêndio o mistério é só leitura: precisa importar para o mundo.
        if (doc.pack) {
          ui.notifications.info(loc("CPRINV.Error.ImportFirst"));
          return this;
        }
        MysteryApp.open(doc);
        return this;
      }
    },
  }[SHEET_CLASS_NAME];

  DocumentSheetConfig.registerSheet(JournalEntry, MODULE_ID, MysteryJournalSheet, {
    label: "CPRINV.Sheet.Label", // traduzido pelo Foundry na exibição (i18n ainda não carregou no init)
    makeDefault: false,
  });
}

export function registerJournalHooks() {
  Hooks.on("renderJournalDirectory", (app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;

    if (!root.querySelector(".cprinv-open-browser")) {
      const actions = root.querySelector(".header-actions") ?? root.querySelector(".directory-header");
      if (actions) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cprinv-open-browser";
        btn.innerHTML = `<i class="fa-solid fa-user-secret"></i> ${loc("CPRINV.Browser.Button")}`;
        btn.addEventListener("click", () => MysteryBrowser.open());
        actions.appendChild(btn);
      }
    }

    // Ícone nos mistérios da lista.
    for (const li of root.querySelectorAll("[data-document-id]")) {
      const journal = game.journal.get(li.dataset.documentId);
      if (!isMystery(journal) || li.querySelector(".cprinv-mystery-icon")) continue;
      const name = li.querySelector(".document-name, .entry-name");
      if (!name) continue;
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-user-secret cprinv-mystery-icon";
      icon.dataset.tooltip = loc("CPRINV.Sheet.Label");
      name.prepend(icon);
    }
  });

  Hooks.on("getJournalDirectoryEntryContext", (html, options) => {
    const journalFrom = (li) => game.journal.get((li?.data ? li.data("documentId") : li?.dataset?.documentId) ?? "");
    options.push({
      name: "CPRINV.Context.OpenMystery",
      icon: '<i class="fa-solid fa-user-secret"></i>',
      condition: (li) => isMystery(journalFrom(li)),
      callback: (li) => MysteryApp.open(journalFrom(li)),
    });
    options.push({
      name: "CPRINV.Context.OpenAsJournal",
      icon: '<i class="fa-solid fa-book-open"></i>',
      condition: (li) => game.user.isGM && isMystery(journalFrom(li)),
      callback: (li) => {
        const journal = journalFrom(li);
        if (!journal) return;
        const Sheet = CONFIG.JournalEntry.sheetClasses?.base?.["core.JournalSheet"]?.cls ?? JournalSheet;
        new Sheet(journal).render(true);
      },
    });
  });

  for (const hook of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry"]) {
    Hooks.on(hook, (journal) => {
      if (hook === "deleteJournalEntry") MysteryApp.instances.get(journal.id)?.close();
      else MysteryApp.refresh(journal.id);
      MysteryBrowser.refresh();
    });
  }
}
