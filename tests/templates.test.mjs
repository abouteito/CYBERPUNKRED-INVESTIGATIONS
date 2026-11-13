/** Compila e renderiza os templates com o contexto real do painel (Foundry simulado). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Handlebars from "handlebars";
import { GRAB_AND_SMASH, SOMEONE_STOLE_IT_FIRST } from "../tools/pack-data.mjs";

const settings = { showDv: false, complexityDisplay: "bar", tiesSucceed: false, mookFocus: true, useWorldTime: true, dayOffset: 0 };
const getProperty = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const actor = { uuid: "Actor.a", name: "Mouse", img: "x.png", type: "character", isOwner: true, hasPlayerOwner: true,
  system: { stats: { int: { value: 6 }, will: { value: 5 } } }, flags: {}, getFlag() { return undefined; } };
let isGM = true;
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OBSERVER: 2 } };
globalThis.foundry = { utils: { deepClone: (o) => structuredClone(o), randomID: () => "r" + Math.random().toString(36).slice(2, 10), getRoute: (p) => p },
  applications: { api: { ApplicationV2: class { constructor(o) { this.options = o; } }, HandlebarsApplicationMixin: (c) => c, DialogV2: {} } } };
globalThis.game = { get user() { return { isGM, name: "u", id: "u" }; }, settings: { get: (_m, k) => settings[k] }, time: { worldTime: 0 },
  i18n: { localize: (k) => k, format: (k) => k }, actors: [actor] };
globalThis.TextEditor = { enrichHTML: async (h) => h };
globalThis.Hooks = { on() {} };

Handlebars.registerHelper("localize", (k) => k);
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("checked", (v) => (v ? "checked" : ""));
Handlebars.registerHelper("selectOptions", (choices, opts) =>
  new Handlebars.SafeString(Object.entries(choices).map(([k, v]) => `<option value="${k}" ${k === opts.hash.selected ? "selected" : ""}>${v}</option>`).join("")));

const { MysteryApp } = await import("../scripts/apps/mystery-app.js");
const { EntryEditor } = await import("../scripts/apps/entry-editor.js");
const Store = await import("../scripts/mystery-store.js");

const compile = (name) => Handlebars.compile(fs.readFileSync(`templates/${name}`, "utf8"), { strict: false });

function journalFor(sample) {
  return { id: "j", name: sample.name, ownership: { default: 2 }, flags: { "cpr-investigation": { mystery: sample.mystery } },
    getFlag(s, k) { return getProperty(this.flags, `${s}.${k}`); } };
}

for (const sample of [GRAB_AND_SMASH, SOMEONE_STOLE_IT_FIRST]) {
  for (const gm of [true, false]) {
    for (const tab of ["clues", "obstacles", "hints", "notes"]) {
      test(`painel ${sample.name} gm=${gm} aba=${tab}`, async () => {
        isGM = gm;
        const app = new MysteryApp(journalFor(sample));
        app.tab = tab;
        const ctx = await app._prepareContext();
        const html = compile("mystery-app.hbs")(ctx);
        assert.ok(html.includes("cprinv-app"));
        if (!gm) {
          // jogador não vê pistas ocultas, notas do mestre nem pista falsa marcada
          assert.ok(!html.includes("CPRINV.Clue.RedHerring"));
          assert.ok(!html.includes('name="'), "jogador não deve ter campos editáveis");
          for (const c of sample.mystery.clues.filter((c) => c.state === "hidden")) assert.ok(!html.includes(c.name));
        }
      });
    }
  }
}

test("editor de pista e de obstáculo renderizam", async () => {
  isGM = true;
  const j = journalFor(SOMEONE_STOLE_IT_FIRST);
  for (const [kind, id] of [["clue", "ssDigital0000001"], ["clue", null], ["obstacle", "ssObsDigital0001"]]) {
    const ed = new EntryEditor(j, kind, id);
    const html = compile("entry-editor.hbs")(await ed._prepareContext());
    assert.ok(html.includes('name="skills"'));
  }
});

test("demais templates compilam", () => {
  compile("chat-card.hbs")({ title: "t", lines: [{ label: "a", value: 1 }], buttons: [{ action: "x", label: "y", data: { "journal-id": "j" } }] });
  compile("focus-widget.hbs")({ value: 3, max: 40, pct: 7, owner: true });
  compile("dialog-skill.hbs")({ suggested: [{ key: "k", label: "l" }], others: [] });
  compile("mystery-browser.hbs")({ gm: true, mysteries: [{ id: "a", name: "n", pct: 50, showBar: true }] });
});
