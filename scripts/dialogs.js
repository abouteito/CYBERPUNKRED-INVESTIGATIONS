/**
 * Janelas curtas (DialogV2): escolher personagem, escolher perícia, ajustar Foco, descanso.
 */
import { isFocusActor, getFocus } from "./focus.js";
import { skillOptions } from "./cpr-adapter.js";
import { escapeHTML, loc, tpl } from "./util.js";

const { DialogV2 } = foundry.applications.api;

/** Personagens que o usuário pode usar num teste. */
export function candidateActors() {
  const unique = (list) => [...new Map(list.map((a) => [a.uuid, a])).values()];
  const controlled = (canvas?.tokens?.controlled ?? [])
    .map((t) => t.actor)
    .filter((a) => a && a.isOwner && isFocusActor(a));
  if (controlled.length) return unique(controlled);

  const own = game.user.character;
  if (!game.user.isGM && own && isFocusActor(own)) return [own];

  let list = game.actors.filter((a) => a.isOwner && isFocusActor(a));
  if (game.user.isGM) {
    const players = list.filter((a) => a.hasPlayerOwner);
    if (players.length) list = players;
  }
  return unique(list);
}

export async function chooseActor({ title } = {}) {
  const actors = candidateActors();
  if (!actors.length) {
    ui.notifications.warn(loc("CPRINV.Error.NoActor"));
    return null;
  }
  if (actors.length === 1) return actors[0];

  const options = actors
    .map((a) => {
      const f = getFocus(a);
      return `<option value="${a.uuid}">${escapeHTML(a.name)} — ${loc("CPRINV.Focus.Label")} ${f.value}/${f.max}</option>`;
    })
    .join("");
  const content = `<div class="form-group"><label>${loc("CPRINV.Dialog.Character")}</label>
    <select name="actor">${options}</select></div>`;

  const uuid = await DialogV2.wait({
    window: { title: title ?? loc("CPRINV.Dialog.ChooseCharacter") },
    classes: ["cprinv", "cprinv-dialog"],
    content,
    buttons: [
      {
        action: "ok",
        label: loc("CPRINV.Dialog.Continue"),
        default: true,
        callback: (event, button) => button.form.elements.actor.value,
      },
      { action: "cancel", label: loc("CPRINV.Dialog.Cancel") },
    ],
    rejectClose: false,
  });
  if (!uuid || uuid === "cancel") return null;
  return actors.find((a) => a.uuid === uuid) ?? null;
}

/**
 * Escolha de perícia para um teste.
 * @returns {Promise<null|{option:object, extraMods:number[]}>}
 */
export async function chooseSkill(actor, { title, targets = [], allowAll = false, penalty = 0, dv = null, note = "" } = {}) {
  const { suggested, others } = skillOptions(actor, targets, allowAll);
  if (!suggested.length && !others.length) {
    ui.notifications.warn(loc("CPRINV.Error.NoSkill", { name: actor.name }));
    return null;
  }
  const all = [...suggested, ...others];
  const content = await renderTemplate(tpl("dialog-skill.hbs"), {
    actorName: actor.name,
    suggested,
    others,
    penalty: penalty || "",
    dv,
    note,
  });

  const result = await DialogV2.wait({
    window: { title: title ?? loc("CPRINV.Dialog.ChooseSkill") },
    classes: ["cprinv", "cprinv-dialog"],
    content,
    buttons: [
      {
        action: "roll",
        label: loc("CPRINV.Dialog.Roll"),
        icon: "fa-solid fa-dice-d10",
        default: true,
        callback: (event, button) => {
          const els = button.form.elements;
          return { key: els.skill.value, mod: Number.parseInt(els.mod?.value, 10) || 0 };
        },
      },
      { action: "cancel", label: loc("CPRINV.Dialog.Cancel") },
    ],
    rejectClose: false,
  });
  if (!result || typeof result !== "object") return null;
  const option = all.find((o) => o.key === result.key);
  if (!option) return null;
  return { option, extraMods: result.mod ? [result.mod] : [] };
}

export async function confirmRest(actor) {
  const content = `<p>${loc("CPRINV.Rest.Explain", { name: escapeHTML(actor.name) })}</p>
    <div class="form-group"><label class="checkbox">
      <input type="checkbox" name="concentration" checked> ${loc("CPRINV.Rest.Concentration")}
    </label></div>`;
  const res = await DialogV2.wait({
    window: { title: loc("CPRINV.Rest.Title") },
    classes: ["cprinv", "cprinv-dialog"],
    content,
    buttons: [
      {
        action: "rest",
        label: loc("CPRINV.Rest.Button"),
        icon: "fa-solid fa-bed",
        default: true,
        callback: (event, button) => ({ concentration: button.form.elements.concentration.checked }),
      },
      { action: "cancel", label: loc("CPRINV.Dialog.Cancel") },
    ],
    rejectClose: false,
  });
  return res && typeof res === "object" ? res : null;
}

export async function promptFocusAdjust(actor) {
  const f = getFocus(actor);
  const content = `<p>${escapeHTML(actor.name)} — ${loc("CPRINV.Focus.Label")} ${f.value}/${f.max}</p>
    <div class="form-group"><label>${loc("CPRINV.Focus.AdjustMode")}</label>
      <select name="mode">
        <option value="delta">${loc("CPRINV.Focus.AdjustDelta")}</option>
        <option value="set">${loc("CPRINV.Focus.AdjustSet")}</option>
      </select></div>
    <div class="form-group"><label>${loc("CPRINV.Focus.AdjustValue")}</label>
      <input type="number" name="value" value="0" step="1"></div>
    <div class="form-group"><label>${loc("CPRINV.Focus.AdjustReason")}</label>
      <input type="text" name="reason" value=""></div>`;
  const res = await DialogV2.wait({
    window: { title: loc("CPRINV.Focus.AdjustTitle") },
    classes: ["cprinv", "cprinv-dialog"],
    content,
    buttons: [
      {
        action: "ok",
        label: loc("CPRINV.Dialog.Apply"),
        default: true,
        callback: (event, button) => {
          const els = button.form.elements;
          return {
            mode: els.mode.value,
            value: Number.parseInt(els.value.value, 10) || 0,
            reason: els.reason.value,
          };
        },
      },
      { action: "cancel", label: loc("CPRINV.Dialog.Cancel") },
    ],
    rejectClose: false,
  });
  return res && typeof res === "object" ? res : null;
}

export async function showFocusLog(actor) {
  const { log } = getFocus(actor);
  const rows = [...log]
    .reverse()
    .map((e) => {
      const date = new Date(e.time).toLocaleString(game.i18n.lang);
      const delta = e.to - e.from;
      const sign = delta > 0 ? "+" : "";
      return `<tr><td>${escapeHTML(date)}</td><td>${e.from} → ${e.to} (${sign}${delta})</td>
        <td>${escapeHTML(e.reason)}</td><td>${escapeHTML(e.user)}</td></tr>`;
    })
    .join("");
  const content = rows
    ? `<table class="cprinv-log"><thead><tr><th>${loc("CPRINV.Log.When")}</th><th>${loc("CPRINV.Log.Change")}</th>
       <th>${loc("CPRINV.Log.Reason")}</th><th>${loc("CPRINV.Log.By")}</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p>${loc("CPRINV.Log.Empty")}</p>`;
  await DialogV2.wait({
    window: { title: loc("CPRINV.Log.Title", { name: actor.name }) },
    classes: ["cprinv", "cprinv-dialog"],
    position: { width: 560 },
    content,
    buttons: [{ action: "close", label: loc("CPRINV.Dialog.Close"), default: true }],
    rejectClose: false,
  });
}

export async function promptText({ title, label, value = "", multiline = true } = {}) {
  const field = multiline
    ? `<textarea name="text" rows="5">${escapeHTML(value)}</textarea>`
    : `<input type="text" name="text" value="${escapeHTML(value)}">`;
  const res = await DialogV2.wait({
    window: { title },
    classes: ["cprinv", "cprinv-dialog"],
    content: `<div class="form-group stacked"><label>${escapeHTML(label ?? "")}</label>${field}</div>`,
    buttons: [
      {
        action: "ok",
        label: loc("CPRINV.Dialog.Save"),
        default: true,
        callback: (event, button) => ({ text: button.form.elements.text.value }),
      },
      { action: "cancel", label: loc("CPRINV.Dialog.Cancel") },
    ],
    rejectClose: false,
  });
  return res && typeof res === "object" ? res.text : null;
}

export async function promptNewMystery() {
  const options = ["easy", "average", "challenging", "difficult", "legendary"]
    .map((d) => `<option value="${d}" ${d === "average" ? "selected" : ""}>${loc(`CPRINV.Difficulty.${d}`)}</option>`)
    .join("");
  const res = await DialogV2.wait({
    window: { title: loc("CPRINV.Mystery.Create") },
    classes: ["cprinv", "cprinv-dialog"],
    content: `<div class="form-group"><label>${loc("CPRINV.Mystery.Name")}</label>
        <input type="text" name="name" value="" autofocus></div>
      <div class="form-group"><label>${loc("CPRINV.Mystery.Difficulty")}</label>
        <select name="difficulty">${options}</select></div>`,
    buttons: [
      {
        action: "ok",
        label: loc("CPRINV.Dialog.Create"),
        default: true,
        callback: (event, button) => ({
          name: button.form.elements.name.value.trim(),
          difficulty: button.form.elements.difficulty.value,
        }),
      },
      { action: "cancel", label: loc("CPRINV.Dialog.Cancel") },
    ],
    rejectClose: false,
  });
  return res && typeof res === "object" ? res : null;
}

/** GM: aplicar resultado de obstáculo resolvido na narração (Beat) a vários personagens. */
export async function promptObstacleResult(actors) {
  if (!actors.length) {
    ui.notifications.warn(loc("CPRINV.Error.NoActor"));
    return null;
  }
  const boxes = actors
    .map(
      (a) => `<label class="checkbox cprinv-check-row">
        <input type="checkbox" name="actor" value="${a.uuid}" checked> ${escapeHTML(a.name)}</label>`
    )
    .join("");
  const res = await DialogV2.wait({
    window: { title: loc("CPRINV.Obstacle.ApplyTitle") },
    classes: ["cprinv", "cprinv-dialog"],
    content: `<p>${loc("CPRINV.Obstacle.ApplyExplain")}</p><div class="cprinv-check-list">${boxes}</div>`,
    buttons: [
      {
        action: "success",
        label: loc("CPRINV.Obstacle.Overcome"),
        icon: "fa-solid fa-check",
        callback: (event, button) => ({ success: true, uuids: checked(button.form) }),
      },
      {
        action: "failure",
        label: loc("CPRINV.Obstacle.Failed"),
        icon: "fa-solid fa-xmark",
        callback: (event, button) => ({ success: false, uuids: checked(button.form) }),
      },
      { action: "cancel", label: loc("CPRINV.Dialog.Cancel") },
    ],
    rejectClose: false,
  });
  return res && typeof res === "object" ? res : null;
}

function checked(form) {
  return [...form.querySelectorAll('input[name="actor"]:checked')].map((i) => i.value);
}
