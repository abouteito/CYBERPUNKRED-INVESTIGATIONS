/**
 * Ponte com o sistema Cyberpunk RED - CORE 0.92.4.
 *
 * Tudo o que depende da estrutura interna do sistema fica aqui, para facilitar a
 * migração para a 0.93 (Foundry v13), que muda rolagens e fichas.
 *
 * Caminhos internos usados (conferir a cada atualização do sistema):
 *  - modules/chat/cpr-chat.js          → CPRChat.RenderRollCard(cprRoll)
 *  - modules/utils/cpr-systemUtils.js  → SystemUtils.slugify / Localize
 *  - item.createRoll("skill", actor)                      (CPRSkillItem)
 *  - item.createRoll("roleAbility", actor, {rollSubType, subRoleName})  (CPRRoleItem)
 *  - cprRoll.handleRollDialog(event, actor, item), cprRoll.roll()
 *  - cprRoll.resultTotal, cprRoll.initialRoll, cprRoll.luck, cprRoll.additionalMods
 *  - actor.system.stats.{int,will}.value, role.system.abilities[{name, hasRoll, rank}]
 */
import { ROLE_PREFIX, SCIENCE_WILDCARD, SYSTEM_ID } from "./constants.js";

let CPRChat = null;
let SystemUtils = null;

export async function initAdapter() {
  const base = `systems/${SYSTEM_ID}/modules`;
  try {
    CPRChat = (await import(foundry.utils.getRoute(`${base}/chat/cpr-chat.js`))).default;
    SystemUtils = (await import(foundry.utils.getRoute(`${base}/utils/cpr-systemUtils.js`))).default;
  } catch (err) {
    console.error("cpr-investigation | não consegui carregar os módulos do sistema", err);
  }
  return Boolean(CPRChat && SystemUtils);
}

export const adapterReady = () => Boolean(CPRChat && SystemUtils);

const slug = (name) => {
  try {
    return SystemUtils ? SystemUtils.slugify(name) : name.replace(/\s+/g, "").toLowerCase();
  } catch {
    return String(name ?? "");
  }
};

/** Nome traduzido de uma perícia do sistema (ex.: "Accounting" → "Contabilidade"). */
export function skillLabel(name) {
  const key = `CPR.global.itemType.skill.${slug(name)}`;
  const label = game.i18n.localize(key);
  return label === key ? name : label;
}

export function stat(actor, key) {
  return Number(actor?.system?.stats?.[key]?.value) || 0;
}

function skillMatches(item, target) {
  if (target === SCIENCE_WILDCARD) {
    const s = slug(item.name).toLowerCase();
    const science = game.i18n.localize("CPR.global.itemType.skill.science");
    return s.startsWith("science") || (science && item.name.startsWith(science));
  }
  if (item.name === target) return true;
  if (slug(item.name) === slug(target)) return true;
  return item.name === skillLabel(target);
}

function skillOption(actor, item, group) {
  const statKey = item.system?.stat;
  const level = Number(item.system?.level) || 0;
  const base = stat(actor, statKey) + level;
  return {
    key: `skill:${item.id}`,
    kind: "skill",
    itemId: item.id,
    label: `${skillLabel(item.name)} (${base})`,
    base,
    group,
  };
}

/**
 * Lista as opções de perícia de um ator para um teste.
 * @param {Actor} actor
 * @param {string[]} targets  nomes de perícia; "role:<habilidade>" e "Science (*)" aceitos
 * @param {boolean} includeAll  incluir todas as perícias (Regra do Legal)
 */
export function skillOptions(actor, targets = [], includeAll = false) {
  const skills = actor.itemTypes?.skill ?? [];
  const suggested = [];
  const seen = new Set();

  for (const target of targets) {
    if (target.startsWith(ROLE_PREFIX)) {
      const abilityName = target.slice(ROLE_PREFIX.length);
      for (const role of actor.itemTypes?.role ?? []) {
        for (const ability of role.system?.abilities ?? []) {
          if (!ability.hasRoll) continue;
          if (ability.name !== abilityName && slug(ability.name) !== slug(abilityName)) continue;
          const key = `role:${role.id}:${ability.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const rank = Number(ability.rank) || 0;
          const base = rank + (ability.stat && ability.stat !== "--" ? stat(actor, ability.stat) : 0);
          suggested.push({
            key,
            kind: "role",
            itemId: role.id,
            ability: ability.name,
            label: `${ability.name} — ${role.name} (${base})`,
            base,
            group: "suggested",
          });
        }
      }
      continue;
    }
    for (const item of skills) {
      if (seen.has(item.id) || !skillMatches(item, target)) continue;
      seen.add(item.id);
      suggested.push(skillOption(actor, item, "suggested"));
    }
  }

  const others = includeAll
    ? skills
        .filter((i) => !seen.has(i.id))
        .map((i) => skillOption(actor, i, "other"))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];
  return { suggested, others };
}

/** Acha a perícia de um ator pelo nome em inglês do sistema (ex.: "Deduction"). */
export function findSkill(actor, name) {
  return (actor.itemTypes?.skill ?? []).find((i) => skillMatches(i, name)) ?? null;
}

function tokenIdFor(actor) {
  if (actor.isToken) {
    const id = actor.token?.id;
    return id && game.actors.tokens[id] ? id : undefined;
  }
  const token = canvas?.tokens?.controlled?.find((t) => t.actor?.id === actor.id);
  return token?.id ?? null;
}

/**
 * Faz um teste de perícia/habilidade pelo fluxo do próprio sistema (janela de modificadores,
 * crítico, Sorte, efeitos) e posta o card de rolagem do sistema.
 *
 * @returns {Promise<null|{total:number, natural:number, label:string}>} null se cancelado
 */
export async function rollCheck(actor, option, { extraMods = [] } = {}) {
  if (!adapterReady()) throw new Error("CPR adapter not ready");
  const item = actor.items.get(option.itemId);
  if (!item) return null;

  let cprRoll;
  if (option.kind === "role") {
    cprRoll = item.createRoll("roleAbility", actor, {
      rollSubType: "subRoleAbility",
      subRoleName: option.ability,
    });
  } else {
    cprRoll = item.createRoll("skill", actor);
  }
  if (!cprRoll) return null;

  const mods = extraMods.filter((m) => Number.isFinite(m) && m !== 0);
  if (mods.length) cprRoll.additionalMods = [...(cprRoll.additionalMods ?? []), ...mods];

  const fakeEvent = { ctrlKey: false, metaKey: false, type: "click" };
  const keepRolling = await cprRoll.handleRollDialog(fakeEvent, actor, item);
  if (!keepRolling) return null;

  await cprRoll.roll();

  // Gasto de Sorte, como a ficha do sistema faz.
  if (Number.isInteger(cprRoll.luck) && cprRoll.luck > 0) {
    const luck = stat(actor, "luck");
    await actor.update({ "system.stats.luck.value": Math.max(0, luck - cprRoll.luck) });
  }

  const tokenId = tokenIdFor(actor);
  const actorKnown = tokenId || game.actors.get(actor.id);
  cprRoll.entityData = actorKnown ? { actor: actor.id, token: tokenId ?? null, tokens: [], item: item.id } : null;
  await CPRChat.RenderRollCard(cprRoll);

  return {
    total: Number(cprRoll.resultTotal) || 0,
    natural: Number(cprRoll.initialRoll) || 0,
    label: cprRoll.rollTitle || item.name,
  };
}
