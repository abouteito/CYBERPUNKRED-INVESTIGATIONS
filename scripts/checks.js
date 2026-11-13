/**
 * Fluxos de jogo: Teste de Evidência, dica, obstáculo, descanso e novo dia.
 *
 * O jogador rola no próprio cliente (janela de modificadores do sistema) e manda o total para o
 * mestre ativo, que compara com a CD (que pode ser secreta), rola o dano e aplica tudo.
 */
import {
  CLUE_TYPES,
  CONCENTRATION_DV,
  HINT_DV,
  HINT_FOCUS_DAMAGE,
  MODULE_ID,
  OBSTACLE_FOCUS_FAILURE,
  OBSTACLE_FOCUS_SUCCESS,
} from "./constants.js";
import { applyClueDamage, attemptedOnDay, canMakeEvidenceCheck, isFumble, isSuccess, restRecovery } from "./rules.js";
import { getSetting } from "./settings.js";
import { InvSocket } from "./socket.js";
import { getFocus, isFocusActor, modifyFocus, setFocus } from "./focus.js";
import { currentDay, getMystery, mutateMystery } from "./mystery-store.js";
import { findSkill, rollCheck, stat } from "./cpr-adapter.js";
import { chooseActor, chooseSkill, confirmRest, promptFocusAdjust } from "./dialogs.js";
import { audienceFor, postCard, richText } from "./chat.js";
import { loc, notify, safeRoll } from "./util.js";

/* -------------------------------------------- */
/*  Utilidades                                  */
/* -------------------------------------------- */

export const clueTypeLabel = (type) => loc(`CPRINV.ClueType.${type}`);
export const clueDisplayName = (clue) => clue.name || clueTypeLabel(clue.type);
export const fumbleTextFor = (clue) =>
  clue.fumbleText || (clue.fumbleEffect === "none" ? "" : loc(`CPRINV.Fumble.${clue.type}`));

const ties = () => getSetting("tiesSucceed");

/** Sem mestre conectado ninguém resolve o teste: avisa antes de rolar. */
function gmOnline() {
  if (game.users.activeGM) return true;
  notify("warn", "CPRINV.Error.NoGM");
  return false;
}

function complexityView(mystery) {
  const mode = getSetting("complexityDisplay");
  const { value, max } = mystery.complexity;
  const pct = Math.round((value / max) * 100);
  if (mode === "number") return { line: { label: loc("CPRINV.Mystery.Complexity"), value: `${value} / ${max}` }, bar: pct };
  if (mode === "bar") return { line: null, bar: pct };
  return { line: null, bar: null };
}

function focusLine(actor, res) {
  return {
    label: loc("CPRINV.Focus.Label"),
    value: `${res.delta >= 0 ? "+" : ""}${res.delta} → ${res.value} / ${res.max}`,
  };
}

async function resolveActor(uuid, user) {
  const actor = await fromUuid(uuid);
  if (!actor) throw new Error(loc("CPRINV.Error.ActorMissing"));
  if (!actor.testUserPermission(user, "OWNER")) throw new Error(loc("CPRINV.Error.NotOwner"));
  if (!isFocusActor(actor)) throw new Error(loc("CPRINV.Error.NotInvestigator", { name: actor.name }));
  return actor;
}

function getJournal(id) {
  const journal = game.journal.get(id);
  if (!journal) throw new Error(loc("CPRINV.Error.MysteryMissing"));
  return journal;
}

async function announceSolved(journal, mystery) {
  await postCard({
    title: loc("CPRINV.Solved.Title"),
    subtitle: journal.name,
    outcome: { label: loc("CPRINV.Solved.Outcome"), cls: "success" },
    body: mystery.goalRevealed ? await richText(mystery.goal) : "",
    audience: audienceFor(journal),
    flags: { type: "solved", journalId: journal.id },
  });
}

/* -------------------------------------------- */
/*  Teste de Evidência                          */
/* -------------------------------------------- */

export async function evidenceCheck(journal, clueId) {
  const mystery = getMystery(journal);
  const clue = mystery.clues.find((c) => c.id === clueId);
  if (!clue || clue.state !== "available") return notify("warn", "CPRINV.Error.ClueUnavailable");
  if (mystery.status === "solved") return notify("info", "CPRINV.Error.AlreadySolved");
  if (!gmOnline()) return;

  const actor = await chooseActor({ title: loc("CPRINV.Check.EvidenceTitle", { clue: clueDisplayName(clue) }) });
  if (!actor) return;
  const focus = getFocus(actor);
  if (!canMakeEvidenceCheck(focus.value)) return notify("warn", "CPRINV.Error.NoFocus", { name: actor.name });
  if (attemptedOnDay(clue, actor.uuid, currentDay())) {
    return notify("warn", "CPRINV.Error.AlreadyTried", { name: actor.name });
  }

  const choice = await chooseSkill(actor, {
    title: loc("CPRINV.Check.EvidenceTitle", { clue: clueDisplayName(clue) }),
    targets: clue.skills,
    allowAll: clue.allowAnySkill || game.user.isGM,
    penalty: clue.penalty,
    dv: getSetting("showDv") || game.user.isGM ? clue.dv : null,
    note: clue.penalty ? loc("CPRINV.Check.PenaltyNote", { value: clue.penalty }) : "",
  });
  if (!choice) return;

  const result = await rollCheck(actor, choice.option, { extraMods: choice.extraMods });
  if (!result) return;

  try {
    await InvSocket.request("evidence", {
      journalId: journal.id,
      clueId,
      actorUuid: actor.uuid,
      total: result.total,
      natural: result.natural,
      label: result.label,
      alternative: choice.option.group === "other",
    });
  } catch (err) {
    ui.notifications.error(err.message);
  }
}

async function handleEvidence(payload, user) {
  const journal = getJournal(payload.journalId);
  const actor = await resolveActor(payload.actorUuid, user);
  const day = currentDay();
  const mystery = getMystery(journal);
  const clue = mystery.clues.find((c) => c.id === payload.clueId);
  if (!clue || !["available", "collected"].includes(clue.state)) throw new Error(loc("CPRINV.Error.ClueUnavailable"));
  if (attemptedOnDay(clue, actor.uuid, day)) throw new Error(loc("CPRINV.Error.AlreadyTried", { name: actor.name }));
  if (!canMakeEvidenceCheck(getFocus(actor).value)) throw new Error(loc("CPRINV.Error.NoFocus", { name: actor.name }));

  const total = Number(payload.total) || 0;
  const natural = Number(payload.natural) || 0;
  const success = isSuccess(total, clue.dv, ties());
  const fumble = isFumble(natural, success);
  const name = clueDisplayName(clue);
  const audience = audienceFor(journal);

  const lines = [{ label: loc("CPRINV.Check.Skill"), value: payload.label }];
  if (payload.alternative) lines.push({ label: loc("CPRINV.Check.Alternative"), value: loc("CPRINV.Check.RuleOfCool") });
  lines.push({ label: loc("CPRINV.Check.Result"), value: getSetting("showDv") ? `${total} vs ${clue.dv}` : `${total}` });

  const rolls = [];
  let body = "";
  let outcome;
  let focusRes = null;
  let dealt = 0;
  let damageTotal = 0;
  const wasSolved = mystery.status === "solved";

  // Pista já coletada por outra pessoa enquanto este teste rolava.
  const alreadyCollected = clue.state === "collected";

  if (success && clue.redHerring) {
    outcome = { label: loc("CPRINV.Check.Debunked"), cls: "info" };
    body = `<p>${loc("CPRINV.Check.DebunkedText")}</p>`;
  } else if (success && alreadyCollected) {
    outcome = { label: loc("CPRINV.Check.Success"), cls: "success" };
    body = `<p>${loc("CPRINV.Check.AlreadyCollected")}</p>`;
  } else if (success) {
    const roll = await safeRoll(clue.damage);
    rolls.push(roll);
    damageTotal = roll.total;
    dealt = applyClueDamage(mystery.complexity.value, roll.total, clue.obfuscation).dealt;
    outcome = { label: loc("CPRINV.Check.ClueCollected"), cls: "success" };
    const showNumbers = getSetting("complexityDisplay") === "number";
    if (showNumbers) {
      const obf = clue.obfuscation ? ` − ${clue.obfuscation}` : "";
      lines.push({ label: loc("CPRINV.Check.Damage"), value: `${roll.total}${obf} = ${dealt}` });
    }
    body = (await richText(clue.revealText)) || `<p>${loc("CPRINV.Check.NoRevealText")}</p>`;
  } else {
    const roll = await safeRoll(clue.focusDamage);
    rolls.push(roll);
    focusRes = await modifyFocus(actor, -roll.total, loc("CPRINV.Focus.ReasonFailedClue", { clue: name }));
    lines.push(focusLine(actor, focusRes));
    outcome = fumble ? { label: loc("CPRINV.Check.Fumble"), cls: "fumble" } : { label: loc("CPRINV.Check.Failure"), cls: "failure" };
    body = `<p>${loc("CPRINV.Check.FailureText")}</p>`;
    if (fumble && !clue.redHerring) {
      const text = fumbleTextFor(clue);
      if (text) body += `<p class="cprinv-fumble-text"><strong>${loc("CPRINV.Check.Fumble")}:</strong> ${await richText(text)}</p>`;
    }
  }

  // Grava o estado da pista.
  await mutateMystery(journal, (m) => {
    const c = m.clues.find((x) => x.id === clue.id);
    if (!c) return;
    c.attempts.push({ actorUuid: actor.uuid, day });
    if (success && clue.redHerring) {
      c.state = "debunked";
      c.collectedBy = actor.name;
    } else if (success && !alreadyCollected) {
      c.state = "collected";
      c.collectedBy = actor.name;
      m.complexity.value = applyClueDamage(m.complexity.value, damageTotal, c.obfuscation).value;
      if (m.complexity.value === 0) m.status = "solved";
    } else if (fumble && !clue.redHerring) {
      if (c.fumbleEffect === "penalty") c.penalty = Math.min(c.penalty, c.fumblePenalty);
      if (c.fumbleEffect === "blocked") {
        c.state = "blocked";
        c.blockedReason = fumbleTextFor(c);
      }
    }
  });

  const after = getMystery(journal);
  const solvedNow = !wasSolved && after.status === "solved";
  const view = complexityView(after);
  if (success && !clue.redHerring && !alreadyCollected && view.line) lines.push(view.line);

  await postCard({
    title: name,
    subtitle: loc("CPRINV.Check.EvidenceSubtitle", { name: actor.name, mystery: journal.name }),
    outcome,
    lines,
    bar: success && !clue.redHerring && !alreadyCollected ? view.bar : null,
    body,
    rolls,
    actor,
    audience,
    user,
    flags: { type: "evidence", journalId: journal.id, clueId: clue.id, success, fumble, dealt },
  });

  if (solvedNow) await announceSolved(journal, after);
  return { success, fumble, dealt, focus: focusRes?.value ?? null };
}

/* -------------------------------------------- */
/*  Dica (Dedução CD 15)                        */
/* -------------------------------------------- */

export async function askHint(journal) {
  if (!gmOnline()) return;
  const actor = await chooseActor({ title: loc("CPRINV.Hint.Title") });
  if (!actor) return;
  const deduction = findSkill(actor, "Deduction");
  if (!deduction) return notify("warn", "CPRINV.Error.NoSkill", { name: actor.name });
  const result = await rollCheck(actor, { kind: "skill", itemId: deduction.id });
  if (!result) return;
  try {
    await InvSocket.request("hint", {
      journalId: journal.id,
      actorUuid: actor.uuid,
      total: result.total,
      natural: result.natural,
    });
  } catch (err) {
    ui.notifications.error(err.message);
  }
}

async function handleHint(payload, user) {
  const journal = getJournal(payload.journalId);
  const actor = await resolveActor(payload.actorUuid, user);
  const success = isSuccess(Number(payload.total) || 0, HINT_DV, ties());
  const roll = await safeRoll(HINT_FOCUS_DAMAGE);
  const focusRes = await modifyFocus(actor, -roll.total, loc("CPRINV.Focus.ReasonHint"));

  await postCard({
    title: loc("CPRINV.Hint.Title"),
    subtitle: `${actor.name} — ${journal.name}`,
    outcome: success
      ? { label: loc("CPRINV.Hint.Success"), cls: "success" }
      : { label: loc("CPRINV.Hint.Failure"), cls: "failure" },
    lines: [
      { label: loc("CPRINV.Check.Result"), value: `${payload.total} vs ${HINT_DV}` },
      focusLine(actor, focusRes),
    ],
    body: `<p>${loc(success ? "CPRINV.Hint.SuccessText" : "CPRINV.Hint.FailureText")}</p>`,
    rolls: [roll],
    actor,
    audience: audienceFor(journal),
    user,
    flags: { type: "hint", journalId: journal.id, success },
  });

  if (success) {
    const next = getMystery(journal).hints.find((h) => !h.revealed);
    await postCard({
      title: loc("CPRINV.Hint.GmTitle"),
      subtitle: `${actor.name} — ${journal.name}`,
      body: next ? await richText(next.text) : `<p>${loc("CPRINV.Hint.GmNoPrepared")}</p>`,
      buttons: next
        ? [
            {
              action: "revealHint",
              label: loc("CPRINV.Hint.Reveal"),
              icon: "fa-solid fa-eye",
              gmOnly: true,
              data: { "journal-id": journal.id, "hint-id": next.id },
            },
          ]
        : [],
      audience: "gm",
      flags: { type: "hint-gm", journalId: journal.id },
    });
  }
  return { success };
}

export async function revealHint(journalId, hintId) {
  if (!game.user.isGM) return;
  const journal = getJournal(journalId);
  const hint = getMystery(journal).hints.find((h) => h.id === hintId);
  if (!hint) return;
  if (!hint.revealed) {
    await mutateMystery(journal, (m) => {
      const h = m.hints.find((x) => x.id === hintId);
      if (h) h.revealed = true;
    });
  }
  await postCard({
    title: loc("CPRINV.Hint.Revealed"),
    subtitle: journal.name,
    body: await richText(hint.text),
    audience: audienceFor(journal),
    flags: { type: "hint-reveal", journalId: journal.id, hintId },
  });
}

/* -------------------------------------------- */
/*  Obstáculos                                  */
/* -------------------------------------------- */

export async function faceObstacle(journal, obstacleId) {
  const mystery = getMystery(journal);
  const obstacle = mystery.obstacles.find((o) => o.id === obstacleId);
  if (!obstacle || obstacle.state !== "active") return notify("warn", "CPRINV.Error.ObstacleUnavailable");
  if (!gmOnline()) return;
  const title = loc("CPRINV.Obstacle.FaceTitle", { name: obstacle.name || loc(`CPRINV.ObstacleType.${obstacle.type}`) });
  const actor = await chooseActor({ title });
  if (!actor) return;
  if (attemptedOnDay(obstacle, actor.uuid, currentDay())) {
    return notify("warn", "CPRINV.Error.AlreadyTried", { name: actor.name });
  }
  const choice = await chooseSkill(actor, {
    title,
    targets: obstacle.skills,
    allowAll: obstacle.allowAnySkill || !obstacle.skills.length || game.user.isGM,
    dv: getSetting("showDv") || game.user.isGM ? obstacle.dv : null,
  });
  if (!choice) return;
  const result = await rollCheck(actor, choice.option, { extraMods: choice.extraMods });
  if (!result) return;
  try {
    await InvSocket.request("obstacle", {
      journalId: journal.id,
      obstacleId,
      actorUuid: actor.uuid,
      total: result.total,
      natural: result.natural,
      label: result.label,
    });
  } catch (err) {
    ui.notifications.error(err.message);
  }
}

async function applyObstacleToActor(journal, obstacle, actor, success, { user, lines = [] } = {}) {
  const roll = await safeRoll(success ? OBSTACLE_FOCUS_SUCCESS : OBSTACLE_FOCUS_FAILURE);
  const obstacleName = obstacle.name || loc(`CPRINV.ObstacleType.${obstacle.type}`);
  const focusRes = await modifyFocus(actor, -roll.total, loc("CPRINV.Focus.ReasonObstacle", { name: obstacleName }));
  await postCard({
    title: obstacleName,
    subtitle: loc("CPRINV.Obstacle.Subtitle", { name: actor.name, mystery: journal.name }),
    outcome: success
      ? { label: loc("CPRINV.Obstacle.Overcome"), cls: "success" }
      : { label: loc("CPRINV.Obstacle.Failed"), cls: "failure" },
    lines: [...lines, focusLine(actor, focusRes)],
    rolls: [roll],
    actor,
    audience: audienceFor(journal),
    user,
    flags: { type: "obstacle", journalId: journal.id, obstacleId: obstacle.id, success },
  });
  return focusRes;
}

async function handleObstacle(payload, user) {
  const journal = getJournal(payload.journalId);
  const actor = await resolveActor(payload.actorUuid, user);
  const day = currentDay();
  const obstacle = getMystery(journal).obstacles.find((o) => o.id === payload.obstacleId);
  if (!obstacle || obstacle.state !== "active") throw new Error(loc("CPRINV.Error.ObstacleUnavailable"));
  if (attemptedOnDay(obstacle, actor.uuid, day)) throw new Error(loc("CPRINV.Error.AlreadyTried", { name: actor.name }));

  const total = Number(payload.total) || 0;
  const success = isSuccess(total, obstacle.dv, ties());
  await mutateMystery(journal, (m) => {
    const o = m.obstacles.find((x) => x.id === obstacle.id);
    if (!o) return;
    o.attempts.push({ actorUuid: actor.uuid, day });
    o.results.push({ actorUuid: actor.uuid, name: actor.name, success });
  });
  const lines = [
    { label: loc("CPRINV.Check.Skill"), value: payload.label },
    { label: loc("CPRINV.Check.Result"), value: getSetting("showDv") ? `${total} vs ${obstacle.dv}` : `${total}` },
  ];
  await applyObstacleToActor(journal, obstacle, actor, success, { user, lines });
  return { success };
}

/** Mestre: obstáculo resolvido na narração (ou numa Beat) para vários personagens. */
export async function applyObstacleResult(journal, obstacleId, actorUuids, success) {
  if (!game.user.isGM) return;
  const obstacle = getMystery(journal).obstacles.find((o) => o.id === obstacleId);
  if (!obstacle) return;
  const actors = [];
  for (const uuid of actorUuids) {
    const a = await fromUuid(uuid);
    if (a && isFocusActor(a)) actors.push(a);
  }
  for (const actor of actors) await applyObstacleToActor(journal, obstacle, actor, success);
  await mutateMystery(journal, (m) => {
    const o = m.obstacles.find((x) => x.id === obstacleId);
    if (!o) return;
    for (const a of actors) o.results.push({ actorUuid: a.uuid, name: a.name, success });
  });
}

/* -------------------------------------------- */
/*  Descanso, ajuste manual e novo dia          */
/* -------------------------------------------- */

export async function rest(actor) {
  if (!actor?.isOwner || !isFocusActor(actor)) return;
  const choice = await confirmRest(actor);
  if (!choice) return;

  let concentration = null;
  const lines = [];
  const rolls = [];
  if (choice.concentration) {
    const skill = findSkill(actor, "Concentration");
    if (!skill) {
      notify("warn", "CPRINV.Error.NoSkill", { name: actor.name });
    } else {
      const r = await rollCheck(actor, { kind: "skill", itemId: skill.id });
      if (!r) return; // cancelou a rolagem: cancela o descanso
      concentration = isSuccess(r.total, CONCENTRATION_DV, ties());
      lines.push({
        label: loc("CPRINV.Rest.ConcentrationShort"),
        value: `${r.total} vs ${CONCENTRATION_DV} — ${loc(concentration ? "CPRINV.Check.Success" : "CPRINV.Check.Failure")}`,
      });
    }
  }
  const amount = restRecovery(stat(actor, "int"), stat(actor, "will"), concentration === true);
  const res = await modifyFocus(actor, amount, loc("CPRINV.Focus.ReasonRest"));
  lines.push(focusLine(actor, res));
  await postCard({
    title: loc("CPRINV.Rest.Title"),
    subtitle: actor.name,
    lines,
    rolls,
    body: `<p>${loc("CPRINV.Rest.Done", { amount })}</p>`,
    actor,
    audience: "public",
    flags: { type: "rest", actorUuid: actor.uuid, amount },
  });
}

export async function adjustFocus(actor) {
  if (!actor?.isOwner) return;
  const res = await promptFocusAdjust(actor);
  if (!res) return;
  const reason = res.reason || loc("CPRINV.Focus.ReasonManual");
  if (res.mode === "set") await setFocus(actor, res.value, reason);
  else await modifyFocus(actor, res.value, reason);
}

export async function newDay() {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, "dayOffset", (getSetting("dayOffset") || 0) + 1);
  await postCard({
    title: loc("CPRINV.Day.NewTitle"),
    body: `<p>${loc("CPRINV.Day.NewText", { day: currentDay() })}</p>`,
    audience: "public",
    flags: { type: "new-day" },
  });
}

/* -------------------------------------------- */
/*  Registro                                    */
/* -------------------------------------------- */

export function registerSocketHandlers() {
  InvSocket.register("evidence", handleEvidence);
  InvSocket.register("hint", handleHint);
  InvSocket.register("obstacle", handleObstacle);
}

export const chatHandlers = {
  revealHint: (data) => revealHint(data.journalId, data.hintId),
};

export { CLUE_TYPES };
