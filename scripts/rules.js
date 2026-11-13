/**
 * Regras puras (sem dependência do Foundry), para poderem ser testadas fora do jogo.
 */
import {
  CLUE_STATES,
  CLUE_TYPES,
  COMPLEXITY,
  CONCENTRATION_BONUS,
  FUMBLE_EFFECTS,
  FUMBLE_NATURAL,
  OBSTACLE_STATES,
  OBSTACLE_TYPES,
  SECONDS_PER_DAY,
} from "./constants.js";

const toInt = (v, fallback = 0) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};
const toStr = (v, fallback = "") => (typeof v === "string" ? v : v == null ? fallback : String(v));
const toBool = (v) => v === true || v === "true" || v === "on" || v === 1;
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/** Foco máximo = 10 + 5 × arredonda_para_cima((INT + VONT) / 2)  (p. 3). */
export function focusMax(int, will) {
  return 10 + 5 * Math.ceil((toInt(int) + toInt(will)) / 2);
}

/** Recuperação ao descansar um dia: INT + VONT, +5 com Concentração CD 15 (p. 3). */
export function restRecovery(int, will, concentrationSuccess = false) {
  return toInt(int) + toInt(will) + (concentrationSuccess ? CONCENTRATION_BONUS : 0);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** No Cyberpunk RED é preciso superar a CD; empate falha (configurável). */
export function isSuccess(total, dv, tiesSucceed = false) {
  return tiesSucceed ? total >= dv : total > dv;
}

/** Fumble: tirou 1 no dado E falhou o teste (p. 4). */
export function isFumble(natural, success) {
  return natural === FUMBLE_NATURAL && !success;
}

/** Dano em Complexidade: dano da pista menos a Ofuscação, nunca negativo (p. 4 e 6). */
export function applyClueDamage(complexity, damage, obfuscation) {
  const dealt = Math.max(0, toInt(damage) - Math.max(0, toInt(obfuscation)));
  const value = Math.max(0, toInt(complexity) - dealt);
  return { dealt, value, solved: value === 0 };
}

export function dayIndex(worldTime, offset = 0, useWorldTime = true) {
  const base = useWorldTime ? Math.floor((Number(worldTime) || 0) / SECONDS_PER_DAY) : 0;
  return base + toInt(offset);
}

/** Uma tentativa por pista, por personagem, por dia (p. 6). */
export function attemptedOnDay(entry, actorUuid, day) {
  return (entry?.attempts ?? []).some((a) => a.actorUuid === actorUuid && a.day === day);
}

export function canMakeEvidenceCheck(focusValue) {
  return focusValue > 0;
}

export function parseSkillList(value) {
  if (Array.isArray(value)) return value.map((s) => toStr(s).trim()).filter(Boolean);
  return toStr(value)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeAttempts(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && a.actorUuid)
    .map((a) => ({ actorUuid: toStr(a.actorUuid), day: toInt(a.day) }));
}

export function normalizeClue(raw = {}, idFn = () => "") {
  const type = pick(raw.type, Object.keys(CLUE_TYPES), "custom");
  const preset = CLUE_TYPES[type];
  return {
    id: toStr(raw.id) || idFn(),
    name: toStr(raw.name),
    type,
    skills: raw.skills === undefined ? [...preset.skills] : parseSkillList(raw.skills),
    allowAnySkill: toBool(raw.allowAnySkill),
    dv: toInt(raw.dv, 13),
    obfuscation: Math.max(0, toInt(raw.obfuscation, 0)),
    damage: toStr(raw.damage, preset.damage) || preset.damage,
    focusDamage: toStr(raw.focusDamage, preset.focusDamage) || preset.focusDamage,
    fumbleEffect: pick(raw.fumbleEffect, FUMBLE_EFFECTS, preset.fumbleEffect),
    fumbleText: toStr(raw.fumbleText),
    fumblePenalty: toInt(raw.fumblePenalty, preset.penalty ?? -4),
    penalty: Math.min(0, toInt(raw.penalty, 0)),
    redHerring: toBool(raw.redHerring),
    state: pick(raw.state, CLUE_STATES, "hidden"),
    revealText: toStr(raw.revealText),
    gmNotes: toStr(raw.gmNotes),
    blockedReason: toStr(raw.blockedReason),
    collectedBy: toStr(raw.collectedBy),
    attempts: normalizeAttempts(raw.attempts),
  };
}

export function normalizeObstacle(raw = {}, idFn = () => "") {
  return {
    id: toStr(raw.id) || idFn(),
    name: toStr(raw.name),
    type: pick(raw.type, OBSTACLE_TYPES, "custom"),
    description: toStr(raw.description),
    skills: parseSkillList(raw.skills),
    allowAnySkill: toBool(raw.allowAnySkill),
    dv: toInt(raw.dv, 13),
    state: pick(raw.state, OBSTACLE_STATES, "hidden"),
    attempts: normalizeAttempts(raw.attempts),
    results: Array.isArray(raw.results)
      ? raw.results
          .filter((r) => r && r.actorUuid)
          .map((r) => ({ actorUuid: toStr(r.actorUuid), name: toStr(r.name), success: toBool(r.success) }))
      : [],
  };
}

export function normalizeHint(raw = {}, idFn = () => "") {
  return { id: toStr(raw.id) || idFn(), text: toStr(raw.text), revealed: toBool(raw.revealed) };
}

export function normalizeMystery(raw = {}, idFn = () => "") {
  const src = raw && typeof raw === "object" ? raw : {};
  const difficulty = pick(src.difficulty, [...Object.keys(COMPLEXITY), "custom"], "average");
  const presetMax = COMPLEXITY[difficulty] ?? 50;
  const max = Math.max(1, toInt(src.complexity?.max, presetMax));
  const value = clamp(toInt(src.complexity?.value, max), 0, max);
  const clockMax = Math.max(1, toInt(src.clock?.max, 6));
  return {
    version: 1,
    goal: toStr(src.goal),
    goalRevealed: src.goalRevealed === undefined ? true : toBool(src.goalRevealed),
    difficulty,
    complexity: { max, value },
    status: value === 0 ? "solved" : pick(src.status, ["active", "solved"], "active"),
    gmNotes: toStr(src.gmNotes),
    clues: Array.isArray(src.clues) ? src.clues.map((c) => normalizeClue(c, idFn)) : [],
    obstacles: Array.isArray(src.obstacles) ? src.obstacles.map((o) => normalizeObstacle(o, idFn)) : [],
    hints: Array.isArray(src.hints) ? src.hints.map((h) => normalizeHint(h, idFn)) : [],
    clock: {
      enabled: toBool(src.clock?.enabled),
      visible: src.clock?.visible === undefined ? true : toBool(src.clock?.visible),
      label: toStr(src.clock?.label),
      max: clockMax,
      value: clamp(toInt(src.clock?.value, 0), 0, clockMax),
    },
  };
}

/** Nova Complexidade quando a dificuldade muda: preserva o progresso. */
export function complexityForDifficulty(current, newDifficulty) {
  const newMax = COMPLEXITY[newDifficulty];
  if (!newMax) return { ...current };
  if (current.value >= current.max) return { max: newMax, value: newMax };
  const done = current.max - current.value;
  return { max: newMax, value: Math.max(0, newMax - done) };
}
