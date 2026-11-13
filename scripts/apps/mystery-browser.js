/**
 * Lista de mistérios (todos os usuários veem os que podem abrir).
 */
import { MODULE_ID } from "../constants.js";
import { getSetting } from "../settings.js";
import { createMystery, currentDay, getMystery, isShared, listMysteries } from "../mystery-store.js";
import { promptNewMystery } from "../dialogs.js";
import * as Checks from "../checks.js";
import { MysteryApp } from "./mystery-app.js";
import { loc, tpl } from "../util.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class MysteryBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance = null;

  static open() {
    this.#instance ??= new this();
    this.#instance.render({ force: true });
    return this.#instance;
  }

  static refresh() {
    if (this.#instance?.rendered) this.#instance.render();
  }

  static DEFAULT_OPTIONS = {
    id: "cprinv-browser",
    classes: ["cprinv", "cprinv-browser"],
    window: { title: "CPRINV.Browser.Title", icon: "fa-solid fa-user-secret", resizable: true },
    position: { width: 480, height: 520 },
    actions: {
      open: MysteryBrowser.#onOpen,
      create: MysteryBrowser.#onCreate,
      newDay: MysteryBrowser.#onNewDay,
      examples: MysteryBrowser.#onExamples,
    },
  };

  static PARTS = {
    body: { template: tpl("mystery-browser.hbs"), scrollable: [".cprinv-scroll"] },
  };

  async _prepareContext() {
    const gm = game.user.isGM;
    const display = gm ? "number" : getSetting("complexityDisplay");
    const mysteries = listMysteries()
      .map((j) => {
        const m = getMystery(j);
        return {
          id: j.id,
          name: j.name,
          solved: m.status === "solved",
          shared: isShared(j),
          difficulty: loc(`CPRINV.Difficulty.${m.difficulty}`),
          showNumber: display === "number",
          showBar: display !== "hidden",
          value: m.complexity.value,
          max: m.complexity.max,
          pct: Math.round((m.complexity.value / m.complexity.max) * 100),
          openClues: m.clues.filter((c) => c.state === "available").length,
        };
      })
      .sort((a, b) => Number(a.solved) - Number(b.solved) || a.name.localeCompare(b.name));
    return {
      gm,
      mysteries,
      day: currentDay(),
      hasExamples: Boolean(game.packs.get(`${MODULE_ID}.mysteries`)),
    };
  }

  static #onOpen(event, target) {
    const journal = game.journal.get(target.closest("[data-journal-id]")?.dataset.journalId);
    if (journal) MysteryApp.open(journal);
  }

  static async #onCreate() {
    if (!game.user.isGM) return;
    const res = await promptNewMystery();
    if (!res) return;
    const journal = await createMystery(res);
    if (journal) MysteryApp.open(journal);
  }

  static #onNewDay() {
    return Checks.newDay();
  }

  static #onExamples() {
    game.packs.get(`${MODULE_ID}.mysteries`)?.render(true);
  }
}
