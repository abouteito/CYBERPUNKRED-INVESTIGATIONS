/**
 * Teste de fluxo com um Foundry simulado: exercita o lado do mestre (validação, dano,
 * Foco, fumble, caso resolvido) sem abrir o jogo.
 */
import test from "node:test";
import assert from "node:assert/strict";

/* ---------- Foundry simulado ---------- */
const getProperty = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const setProperty = (o, p, v) => {
  const ks = p.split(".");
  let cur = o;
  for (const k of ks.slice(0, -1)) cur = cur[k] ??= {};
  cur[ks.at(-1)] = v;
};
let rollQueue = [];
class FakeRoll {
  constructor(formula) {
    this.formula = formula;
  }
  static validate(f) {
    return /^\d*d\d+|^\d+$/.test(f);
  }
  async evaluate() {
    this.total = rollQueue.length ? rollQueue.shift() : 3;
    return this;
  }
}
const messages = [];
const settings = { showDv: false, complexityDisplay: "number", tiesSucceed: false, mookFocus: true, useWorldTime: true, dayOffset: 0 };

function makeDoc(data) {
  return {
    ...data,
    flags: data.flags ?? {},
    getFlag(scope, key) {
      return getProperty(this.flags, `${scope}.${key}`);
    },
    async update(changes) {
      for (const [k, v] of Object.entries(changes)) {
        if (k.startsWith("flags.")) setProperty(this.flags, k.slice(6), structuredClone(v));
        else setProperty(this, k, v);
      }
      return this;
    },
  };
}

const actor = makeDoc({
  id: "a1",
  uuid: "Actor.a1",
  name: "Mouse",
  type: "character",
  system: { stats: { int: { value: 6 }, will: { value: 5 }, luck: { value: 5 } } },
  testUserPermission: () => true,
});
const journal = makeDoc({ id: "j1", name: "Grab and Smash", ownership: { default: 2 } });

globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
globalThis.foundry = {
  utils: {
    deepClone: (o) => structuredClone(o),
    randomID: () => Math.random().toString(36).slice(2, 12),
    getRoute: (p) => p,
    hasProperty: (o, p) => getProperty(o, p) !== undefined,
  },
  applications: { api: { DialogV2: {}, ApplicationV2: class {}, HandlebarsApplicationMixin: (c) => c } },
};
const self = { id: "gm", isGM: true, isSelf: true, name: "GM" };
globalThis.game = {
  user: self,
  users: Object.assign([self], { activeGM: self, get: () => self }),
  journal: { get: (id) => (id === "j1" ? journal : null) },
  time: { worldTime: 0 },
  settings: { get: (_m, k) => settings[k], set: async (_m, k, v) => (settings[k] = v) },
  i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}`, lang: "pt-BR" },
  actors: { tokens: {}, get: () => actor },
};
globalThis.Roll = FakeRoll;
globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
globalThis.CONFIG = { sounds: { dice: "dice.wav" } };
globalThis.renderTemplate = async (_p, data) => JSON.stringify(data);
globalThis.TextEditor = { enrichHTML: async (h) => h };
globalThis.fromUuid = async (u) => (u === actor.uuid ? actor : null);
globalThis.ChatMessage = {
  getSpeaker: (o) => o,
  create: async (d) => {
    messages.push(d);
    return d;
  },
};
globalThis.Hooks = { on() {}, once() {} };

const { InvSocket } = await import("../scripts/socket.js");
const Checks = await import("../scripts/checks.js");
const Store = await import("../scripts/mystery-store.js");
const Focus = await import("../scripts/focus.js");
Checks.registerSocketHandlers();

const lastCard = () => JSON.parse(messages.at(-1).content);

async function setup(clueOverrides = {}, complexity = { max: 25, value: 25 }) {
  journal.flags = {};
  actor.flags = {};
  messages.length = 0;
  await Store.saveMystery(journal, {
    difficulty: "easy",
    complexity,
    clues: [
      { id: "c1", type: "forensics", dv: 13, obfuscation: 2, state: "available", revealText: "A porta foi aberta com chave.", ...clueOverrides },
    ],
  });
}

test("Foco inicial = máximo pela fórmula", () => {
  actor.flags = {};
  assert.deepEqual(Focus.getFocus(actor), { value: 40, max: 40, log: [] }); // INT 6 + VONT 5 → ceil(5.5)=6 → 40
});

test("sucesso: dano − Ofuscação sai da Complexidade e a pista é coletada", async () => {
  await setup();
  rollQueue = [10];
  const r = await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 18, natural: 7, label: "Deduction" });
  assert.equal(r.success, true);
  assert.equal(r.dealt, 8);
  const m = Store.getMystery(journal);
  assert.equal(m.complexity.value, 17);
  assert.equal(m.clues[0].state, "collected");
  assert.equal(m.clues[0].collectedBy, "Mouse");
  assert.equal(m.clues[0].attempts.length, 1);
  assert.equal(messages.at(-1).rolls.length, 1);
  assert.ok(lastCard().body.includes("A porta foi aberta"));
});

test("empate com a CD falha (precisa superar) e tira Foco", async () => {
  await setup();
  rollQueue = [6];
  const r = await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 13, natural: 5, label: "Deduction" });
  assert.equal(r.success, false);
  assert.equal(Focus.getFocus(actor).value, 34);
  assert.equal(Store.getMystery(journal).clues[0].state, "available");
  assert.equal(Focus.getFocus(actor).log.length, 1);
});

test("uma tentativa por pista por dia; novo dia libera", async () => {
  await setup();
  rollQueue = [2];
  await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 5, natural: 3, label: "x" });
  await assert.rejects(
    InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 20, natural: 9, label: "x" }),
    /AlreadyTried/
  );
  await Checks.newDay();
  rollQueue = [4];
  const r = await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 20, natural: 9, label: "x" });
  assert.equal(r.success, true);
  settings.dayOffset = 0;
});

test("fumble em perícia forense bloqueia a pista", async () => {
  await setup();
  rollQueue = [5];
  const r = await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 4, natural: 1, label: "x" });
  assert.equal(r.fumble, true);
  const c = Store.getMystery(journal).clues[0];
  assert.equal(c.state, "blocked");
  assert.ok(c.blockedReason.includes("CPRINV.Fumble.forensics"));
});

test("fumble em autópsia aplica −4 nos próximos testes", async () => {
  await setup({ type: "autopsy", fumbleEffect: "penalty", fumblePenalty: -4 });
  rollQueue = [5];
  await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 4, natural: 1, label: "x" });
  const c = Store.getMystery(journal).clues[0];
  assert.equal(c.penalty, -4);
  assert.equal(c.state, "available");
});

test("pista falsa: sucesso descarta sem mexer na Complexidade; falha tira Foco", async () => {
  await setup({ redHerring: true });
  await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 20, natural: 9, label: "x" });
  let m = Store.getMystery(journal);
  assert.equal(m.clues[0].state, "debunked");
  assert.equal(m.complexity.value, 25);

  await setup({ redHerring: true });
  rollQueue = [4];
  await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 2, natural: 1, label: "x" });
  m = Store.getMystery(journal);
  assert.equal(m.clues[0].state, "available"); // fumble de pista falsa não bloqueia nem revela
  assert.equal(Focus.getFocus(actor).value, 36);
});

test("Foco 0 impede Testes de Evidência", async () => {
  await setup();
  await Focus.setFocus(actor, 0, "teste");
  await assert.rejects(
    InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 20, natural: 9, label: "x" }),
    /NoFocus/
  );
});

test("zerar a Complexidade resolve o caso e anuncia", async () => {
  await setup({}, { max: 25, value: 5 });
  rollQueue = [12];
  await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 20, natural: 9, label: "x" });
  const m = Store.getMystery(journal);
  assert.equal(m.complexity.value, 0);
  assert.equal(m.status, "solved");
  assert.equal(JSON.parse(messages.at(-1).content).title, "CPRINV.Solved.Title");
});

test("dica: custa 1d6 de Foco sempre e avisa o mestre no sucesso", async () => {
  await setup();
  await Store.mutateMystery(journal, (m) => {
    m.hints.push({ id: "h1", text: "Fale com o filho do fornecedor.", revealed: false });
  });
  rollQueue = [3];
  const r = await InvSocket.request("hint", { journalId: "j1", actorUuid: actor.uuid, total: 16, natural: 6 });
  assert.equal(r.success, true);
  assert.equal(Focus.getFocus(actor).value, 37);
  const gmCard = messages.at(-1);
  assert.deepEqual(gmCard.whisper, ["gm"]);
  assert.ok(JSON.parse(gmCard.content).body.includes("filho do fornecedor"));
  await Checks.revealHint("j1", "h1");
  assert.equal(Store.getMystery(journal).hints[0].revealed, true);
});

test("obstáculo: superar custa 1d6, falhar 2d6", async () => {
  await setup();
  await Store.mutateMystery(journal, (m) => {
    m.obstacles.push({ id: "o1", type: "authority", dv: 13, state: "active" });
  });
  rollQueue = [2];
  await InvSocket.request("obstacle", { journalId: "j1", obstacleId: "o1", actorUuid: actor.uuid, total: 15, natural: 5, label: "x" });
  assert.equal(Focus.getFocus(actor).value, 38);
  assert.equal(Store.getMystery(journal).obstacles[0].results[0].success, true);
  assert.equal(messages.at(-1).rolls[0].formula, "1d6");
});

test("mistério oculto: card só para mestre + quem rolou", async () => {
  await setup();
  journal.ownership.default = 0;
  rollQueue = [2];
  await InvSocket.request("evidence", { journalId: "j1", clueId: "c1", actorUuid: actor.uuid, total: 5, natural: 4, label: "x" });
  assert.deepEqual(messages.at(-1).whisper, ["gm"]);
  journal.ownership.default = 2;
});
