/**
 * Painel de um mistério. O mestre edita tudo; jogadores veem o que foi revelado e fazem os testes.
 */
import { COMPLEXITY, OBFUSCATION, ROLE_PREFIX, SCIENCE_WILDCARD } from "../constants.js";
import { attemptedOnDay, complexityForDifficulty, clamp } from "../rules.js";
import { getSetting } from "../settings.js";
import { currentDay, getMystery, isShared, mutateMystery, newHint, setShared } from "../mystery-store.js";
import { getFocus, isFocusActor } from "../focus.js";
import { skillLabel } from "../cpr-adapter.js";
import * as Checks from "../checks.js";
import { promptObstacleResult, promptText } from "../dialogs.js";
import { postCard, richText, audienceFor } from "../chat.js";
import { EntryEditor } from "./entry-editor.js";
import { loc, tpl } from "../util.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export function skillListLabel(skills) {
  return skills
    .map((s) => {
      if (s.startsWith(ROLE_PREFIX)) return s.slice(ROLE_PREFIX.length);
      if (s === SCIENCE_WILDCARD) return loc("CPRINV.Skill.AnyScience");
      return skillLabel(s);
    })
    .join(", ");
}

export class MysteryApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instances = new Map();

  constructor(journal, options = {}) {
    super({ ...options, id: `cprinv-mystery-${journal.id}` });
    this.journal = journal;
  }

  static open(journal) {
    if (!journal) return null;
    let app = this.instances.get(journal.id);
    if (!app) {
      app = new this(journal);
      this.instances.set(journal.id, app);
    }
    app.render({ force: true });
    return app;
  }

  static refresh(journalId) {
    this.instances.get(journalId)?.render();
  }

  static refreshAll() {
    for (const app of this.instances.values()) app.render();
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["cprinv", "cprinv-mystery"],
    window: { icon: "fa-solid fa-magnifying-glass", resizable: true },
    position: { width: 720, height: 760 },
    form: { handler: MysteryApp.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      evidenceCheck: MysteryApp.#onEvidenceCheck,
      askHint: MysteryApp.#onAskHint,
      faceObstacle: MysteryApp.#onFaceObstacle,
      addClue: MysteryApp.#onAddClue,
      editClue: MysteryApp.#onEditClue,
      deleteClue: MysteryApp.#onDeleteClue,
      resetAttempts: MysteryApp.#onResetAttempts,
      addObstacle: MysteryApp.#onAddObstacle,
      editObstacle: MysteryApp.#onEditObstacle,
      deleteObstacle: MysteryApp.#onDeleteObstacle,
      applyObstacle: MysteryApp.#onApplyObstacle,
      addHint: MysteryApp.#onAddHint,
      editHint: MysteryApp.#onEditHint,
      deleteHint: MysteryApp.#onDeleteHint,
      revealHint: MysteryApp.#onRevealHint,
      clockUp: MysteryApp.#onClockUp,
      clockDown: MysteryApp.#onClockDown,
      solve: MysteryApp.#onSolve,
      toggleShare: MysteryApp.#onToggleShare,
      adjustFocus: MysteryApp.#onAdjustFocus,
      newDay: MysteryApp.#onNewDay,
      setTab: MysteryApp.#onSetTab,
    },
  };

  static PARTS = {
    body: { template: tpl("mystery-app.hbs"), scrollable: [".cprinv-scroll"] },
  };

  tab = "clues";

  get title() {
    return this.journal.name;
  }

  async close(options) {
    MysteryApp.instances.delete(this.journal.id);
    return super.close(options);
  }

  async _prepareContext() {
    const journal = this.journal;
    const m = getMystery(journal);
    const gm = game.user.isGM;
    const showDv = gm || getSetting("showDv");
    const display = gm ? "number" : getSetting("complexityDisplay");
    const day = currentDay();
    const myActors = game.actors.filter((a) => a.isOwner && isFocusActor(a));
    const solved = m.status === "solved";

    const clues = [];
    for (const c of m.clues) {
      if (!gm && c.state === "hidden") continue;
      const triedToday = myActors.filter((a) => attemptedOnDay(c, a.uuid, day)).map((a) => a.name);
      clues.push({
        ...c,
        displayName: Checks.clueDisplayName(c),
        typeLabel: Checks.clueTypeLabel(c.type),
        stateLabel: loc(`CPRINV.ClueState.${c.state}`),
        skillsLabel: skillListLabel(c.skills),
        showDv,
        revealHtml: c.state === "collected" || gm ? await richText(c.revealText) : "",
        gmNotesHtml: gm ? await richText(c.gmNotes) : "",
        fumble: Checks.fumbleTextFor(c),
        canCheck: c.state === "available" && !solved,
        triedToday: triedToday.join(", "),
        attemptsToday: c.attempts.filter((a) => a.day === day).length,
        stateChoices: Object.fromEntries(
          ["hidden", "available", "collected", "debunked", "blocked"].map((s) => [s, loc(`CPRINV.ClueState.${s}`)])
        ),
      });
    }

    const obstacles = [];
    for (const o of m.obstacles) {
      if (!gm && o.state === "hidden") continue;
      obstacles.push({
        ...o,
        displayName: o.name || loc(`CPRINV.ObstacleType.${o.type}`),
        typeLabel: loc(`CPRINV.ObstacleType.${o.type}`),
        stateLabel: loc(`CPRINV.ObstacleState.${o.state}`),
        descriptionHtml: await richText(o.description),
        skillsLabel: skillListLabel(o.skills),
        showDv,
        canFace: o.state === "active" && !solved,
        resultsLabel: o.results.map((r) => `${r.name} ${r.success ? "✔" : "✘"}`).join(", "),
        stateChoices: Object.fromEntries(
          ["hidden", "active", "resolved"].map((s) => [s, loc(`CPRINV.ObstacleState.${s}`)])
        ),
      });
    }

    const hints = [];
    for (const h of m.hints) {
      if (!gm && !h.revealed) continue;
      hints.push({ ...h, html: await richText(h.text) });
    }

    const investigators = gm
      ? game.actors
          .filter((a) => a.hasPlayerOwner && isFocusActor(a))
          .map((a) => {
            const f = getFocus(a);
            return { uuid: a.uuid, name: a.name, img: a.img, value: f.value, max: f.max, zero: f.value <= 0 };
          })
      : myActors.map((a) => {
          const f = getFocus(a);
          return { uuid: a.uuid, name: a.name, img: a.img, value: f.value, max: f.max, zero: f.value <= 0 };
        });

    const pct = Math.round((m.complexity.value / m.complexity.max) * 100);
    return {
      gm,
      tab: this.tab,
      name: journal.name,
      mystery: m,
      solved,
      shared: isShared(journal),
      goalHtml: gm || m.goalRevealed ? await richText(m.goal) : "",
      gmNotesHtml: gm ? await richText(m.gmNotes) : "",
      complexity: {
        showNumber: display === "number",
        showBar: display !== "hidden",
        value: m.complexity.value,
        max: m.complexity.max,
        pct,
      },
      difficultyChoices: Object.fromEntries(
        [...Object.keys(COMPLEXITY), "custom"].map((d) => [
          d,
          d === "custom" ? loc("CPRINV.Difficulty.custom") : `${loc(`CPRINV.Difficulty.${d}`)} (${COMPLEXITY[d]})`,
        ])
      ),
      clues,
      obstacles,
      hints,
      investigators,
      clock: { ...m.clock, show: m.clock.enabled && (gm || m.clock.visible), remaining: m.clock.max - m.clock.value },
      clockSegments: Array.from({ length: m.clock.max }, (_, i) => ({ filled: i < m.clock.value })),
      day,
      obfuscationLabels: OBFUSCATION,
    };
  }

  /* ------------------------------------------ */

  static async #onSubmit(event, form, formData) {
    if (!game.user.isGM) return;
    const data = foundry.utils.expandObject(formData.object);
    const journal = this.journal;
    if (typeof data.name === "string" && data.name.trim() && data.name !== journal.name) {
      await journal.update({ name: data.name.trim() });
    }
    await mutateMystery(journal, (m) => {
      if (typeof data.goal === "string") m.goal = data.goal;
      if (typeof data.gmNotes === "string") m.gmNotes = data.gmNotes;
      if ("goalRevealed" in data) m.goalRevealed = Boolean(data.goalRevealed);

      if (data.difficulty && data.difficulty !== m.difficulty) {
        if (data.difficulty !== "custom") m.complexity = complexityForDifficulty(m.complexity, data.difficulty);
        m.difficulty = data.difficulty;
      } else if (data.complexity) {
        const max = Math.max(1, Number.parseInt(data.complexity.max, 10) || m.complexity.max);
        const value = clamp(Number.parseInt(data.complexity.value, 10) || 0, 0, max);
        if (max !== m.complexity.max && m.difficulty !== "custom" && COMPLEXITY[m.difficulty] !== max) {
          m.difficulty = "custom";
        }
        m.complexity = { max, value };
      }
      m.status = m.complexity.value === 0 ? "solved" : "active";

      if (data.clock) {
        if ("enabled" in data.clock) m.clock.enabled = Boolean(data.clock.enabled);
        if ("visible" in data.clock) m.clock.visible = Boolean(data.clock.visible);
        if (typeof data.clock.label === "string") m.clock.label = data.clock.label;
        if (data.clock.max !== undefined) m.clock.max = Math.max(1, Number.parseInt(data.clock.max, 10) || 1);
        m.clock.value = clamp(m.clock.value, 0, m.clock.max);
      }
      for (const [id, state] of Object.entries(data.clueState ?? {})) {
        const c = m.clues.find((x) => x.id === id);
        if (c && c.state !== state) {
          c.state = state;
          if (state !== "blocked") c.blockedReason = "";
        }
      }
      for (const [id, state] of Object.entries(data.obstacleState ?? {})) {
        const o = m.obstacles.find((x) => x.id === id);
        if (o) o.state = state;
      }
    });
  }

  static #id(target, attr) {
    return target.closest(`[data-${attr}]`)?.dataset?.[attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
  }

  static #onSetTab(event, target) {
    this.tab = target.dataset.tab;
    this.render();
  }

  static #onEvidenceCheck(event, target) {
    return Checks.evidenceCheck(this.journal, MysteryApp.#id(target, "clue-id"));
  }

  static #onAskHint() {
    return Checks.askHint(this.journal);
  }

  static #onFaceObstacle(event, target) {
    return Checks.faceObstacle(this.journal, MysteryApp.#id(target, "obstacle-id"));
  }

  static #onAddClue() {
    EntryEditor.open(this.journal, "clue", null);
  }

  static #onEditClue(event, target) {
    EntryEditor.open(this.journal, "clue", MysteryApp.#id(target, "clue-id"));
  }

  static async #onDeleteClue(event, target) {
    const id = MysteryApp.#id(target, "clue-id");
    const ok = await DialogV2.confirm({
      window: { title: loc("CPRINV.Clue.Delete") },
      content: `<p>${loc("CPRINV.Dialog.ConfirmDelete")}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    await mutateMystery(this.journal, (m) => {
      m.clues = m.clues.filter((c) => c.id !== id);
    });
  }

  static async #onResetAttempts(event, target) {
    const id = MysteryApp.#id(target, "clue-id");
    await mutateMystery(this.journal, (m) => {
      const c = m.clues.find((x) => x.id === id);
      if (c) {
        c.attempts = [];
        c.penalty = 0;
      }
    });
  }

  static #onAddObstacle() {
    EntryEditor.open(this.journal, "obstacle", null);
  }

  static #onEditObstacle(event, target) {
    EntryEditor.open(this.journal, "obstacle", MysteryApp.#id(target, "obstacle-id"));
  }

  static async #onDeleteObstacle(event, target) {
    const id = MysteryApp.#id(target, "obstacle-id");
    const ok = await DialogV2.confirm({
      window: { title: loc("CPRINV.Obstacle.Delete") },
      content: `<p>${loc("CPRINV.Dialog.ConfirmDelete")}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    await mutateMystery(this.journal, (m) => {
      m.obstacles = m.obstacles.filter((o) => o.id !== id);
    });
  }

  static async #onApplyObstacle(event, target) {
    const id = MysteryApp.#id(target, "obstacle-id");
    const actors = game.actors.filter((a) => a.hasPlayerOwner && isFocusActor(a));
    const controlled = (canvas?.tokens?.controlled ?? []).map((t) => t.actor).filter((a) => a && isFocusActor(a));
    const list = [...new Map([...controlled, ...actors].map((a) => [a.uuid, a])).values()];
    const res = await promptObstacleResult(list);
    if (!res || !res.uuids?.length) return;
    await Checks.applyObstacleResult(this.journal, id, res.uuids, res.success);
  }

  static async #onAddHint() {
    const text = await promptText({ title: loc("CPRINV.Hint.Add"), label: loc("CPRINV.Hint.Text") });
    if (!text) return;
    await mutateMystery(this.journal, (m) => {
      m.hints.push(newHint({ text }));
    });
  }

  static async #onEditHint(event, target) {
    const id = MysteryApp.#id(target, "hint-id");
    const hint = getMystery(this.journal).hints.find((h) => h.id === id);
    if (!hint) return;
    const text = await promptText({ title: loc("CPRINV.Hint.Edit"), label: loc("CPRINV.Hint.Text"), value: hint.text });
    if (text === null) return;
    await mutateMystery(this.journal, (m) => {
      const h = m.hints.find((x) => x.id === id);
      if (h) h.text = text;
    });
  }

  static async #onDeleteHint(event, target) {
    const id = MysteryApp.#id(target, "hint-id");
    await mutateMystery(this.journal, (m) => {
      m.hints = m.hints.filter((h) => h.id !== id);
    });
  }

  static #onRevealHint(event, target) {
    return Checks.revealHint(this.journal.id, MysteryApp.#id(target, "hint-id"));
  }

  static async #onClockUp() {
    await mutateMystery(this.journal, (m) => {
      m.clock.value = clamp(m.clock.value + 1, 0, m.clock.max);
    });
  }

  static async #onClockDown() {
    await mutateMystery(this.journal, (m) => {
      m.clock.value = clamp(m.clock.value - 1, 0, m.clock.max);
    });
  }

  static async #onSolve() {
    const m = getMystery(this.journal);
    if (m.status === "solved") {
      // Reabrir: devolve 1 ponto de Complexidade.
      await mutateMystery(this.journal, (d) => {
        d.complexity.value = Math.max(1, d.complexity.value);
        d.status = "active";
      });
      return;
    }
    const ok = await DialogV2.confirm({
      window: { title: loc("CPRINV.Mystery.Solve") },
      content: `<p>${loc("CPRINV.Mystery.SolveConfirm")}</p>`,
      rejectClose: false,
    });
    if (!ok) return;
    const after = await mutateMystery(this.journal, (d) => {
      d.complexity.value = 0;
      d.status = "solved";
    });
    await postCard({
      title: loc("CPRINV.Solved.Title"),
      subtitle: this.journal.name,
      outcome: { label: loc("CPRINV.Solved.Outcome"), cls: "success" },
      body: after.goalRevealed ? await richText(after.goal) : "",
      audience: audienceFor(this.journal),
      flags: { type: "solved", journalId: this.journal.id },
    });
  }

  static async #onToggleShare() {
    await setShared(this.journal, !isShared(this.journal));
  }

  static async #onAdjustFocus(event, target) {
    const actor = await fromUuid(MysteryApp.#id(target, "actor-uuid"));
    if (actor) await Checks.adjustFocus(actor);
  }

  static #onNewDay() {
    return Checks.newDay();
  }
}
