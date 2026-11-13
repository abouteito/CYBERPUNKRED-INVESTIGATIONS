/**
 * Editor de pista ou obstáculo (só mestre).
 */
import { CLUE_TYPES, FUMBLE_EFFECTS, OBFUSCATION, OBSTACLE_TYPES, ROLE_PREFIX, SCIENCE_WILDCARD } from "../constants.js";
import { parseSkillList } from "../rules.js";
import { getMystery, mutateMystery, newClue, newObstacle } from "../mystery-store.js";
import { loc, tpl } from "../util.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class EntryEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(journal, kind, entryId, options = {}) {
    super({ ...options, id: `cprinv-editor-${journal.id}-${entryId ?? foundry.utils.randomID(8)}` });
    this.journal = journal;
    this.kind = kind;
    this.entryId = entryId;
  }

  static open(journal, kind, entryId) {
    if (!game.user.isGM) return null;
    const app = new this(journal, kind, entryId);
    app.render({ force: true });
    return app;
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["cprinv", "cprinv-editor"],
    window: { icon: "fa-solid fa-pen-to-square", resizable: true },
    position: { width: 560, height: "auto" },
    form: { handler: EntryEditor.#onSubmit, submitOnChange: false, closeOnSubmit: true },
  };

  static PARTS = {
    body: { template: tpl("entry-editor.hbs") },
  };

  get title() {
    const key = this.kind === "clue" ? "CPRINV.Clue" : "CPRINV.Obstacle";
    return loc(this.entryId ? `${key}.Edit` : `${key}.Add`);
  }

  #entry() {
    const m = getMystery(this.journal);
    const list = this.kind === "clue" ? m.clues : m.obstacles;
    const found = this.entryId ? list.find((e) => e.id === this.entryId) : null;
    if (found) return found;
    return this.kind === "clue" ? newClue({ type: "observation", state: "hidden" }) : newObstacle({ state: "hidden" });
  }

  async _prepareContext() {
    const entry = this.#entry();
    const isClue = this.kind === "clue";
    const typeKeys = isClue ? Object.keys(CLUE_TYPES) : OBSTACLE_TYPES;
    return {
      isClue,
      entry,
      skillsText: entry.skills.join(", "),
      typeChoices: Object.fromEntries(
        typeKeys.map((t) => [t, loc(isClue ? `CPRINV.ClueType.${t}` : `CPRINV.ObstacleType.${t}`)])
      ),
      stateChoices: Object.fromEntries(
        (isClue ? ["hidden", "available", "collected", "debunked", "blocked"] : ["hidden", "active", "resolved"]).map(
          (s) => [s, loc(isClue ? `CPRINV.ClueState.${s}` : `CPRINV.ObstacleState.${s}`)]
        )
      ),
      obfuscationChoices: Object.entries(OBFUSCATION).map(([k, v]) => ({
        value: v,
        label: `${loc(`CPRINV.Obfuscation.${k}`)} (${v})`,
        selected: v === entry.obfuscation,
      })),
      obfuscationCustom: !Object.values(OBFUSCATION).includes(entry.obfuscation),
      fumbleChoices: Object.fromEntries(FUMBLE_EFFECTS.map((f) => [f, loc(`CPRINV.FumbleEffect.${f}`)])),
      skillHelp: loc("CPRINV.Editor.SkillHelp", { role: `${ROLE_PREFIX}Surgery Skill`, science: SCIENCE_WILDCARD }),
      fumbleDefault: isClue ? loc(`CPRINV.Fumble.${entry.type}`) : "",
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (this.kind !== "clue") return;
    const form = this.element;
    const typeSelect = form.querySelector('select[name="type"]');
    typeSelect?.addEventListener("change", () => {
      const preset = CLUE_TYPES[typeSelect.value];
      if (!preset) return;
      form.querySelector('input[name="skills"]').value = preset.skills.join(", ");
      form.querySelector('input[name="damage"]').value = preset.damage;
      form.querySelector('input[name="focusDamage"]').value = preset.focusDamage;
      form.querySelector('select[name="fumbleEffect"]').value = preset.fumbleEffect;
      const fumble = form.querySelector('textarea[name="fumbleText"]');
      if (fumble) fumble.placeholder = loc(`CPRINV.Fumble.${typeSelect.value}`);
    });
  }

  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    data.skills = parseSkillList(data.skills);
    if (data.obfuscationCustom !== undefined && data.obfuscationCustom !== "" && data.obfuscationCustom !== null) {
      const custom = Number.parseInt(data.obfuscationCustom, 10);
      if (Number.isFinite(custom)) data.obfuscation = custom;
    }
    delete data.obfuscationCustom;

    const listKey = this.kind === "clue" ? "clues" : "obstacles";
    const id = this.entryId;
    await mutateMystery(this.journal, (m) => {
      const list = m[listKey];
      const idx = id ? list.findIndex((e) => e.id === id) : -1;
      if (idx >= 0) {
        list[idx] = this.kind === "clue" ? newClue({ ...list[idx], ...data }) : newObstacle({ ...list[idx], ...data });
      } else {
        list.push(this.kind === "clue" ? newClue(data) : newObstacle(data));
      }
    });
  }
}
