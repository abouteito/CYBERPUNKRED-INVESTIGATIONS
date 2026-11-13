import test from "node:test";
import assert from "node:assert/strict";
import {
  applyClueDamage,
  attemptedOnDay,
  complexityForDifficulty,
  dayIndex,
  focusMax,
  isFumble,
  isSuccess,
  normalizeClue,
  normalizeMystery,
  parseSkillList,
  restRecovery,
} from "../scripts/rules.js";

test("Foco bate com a tabela INT × VONT da p. 3", () => {
  // Linhas = VONT 2..10, colunas = INT 2..10, copiadas do PDF.
  const table = [
    [20, 25, 25, 30, 30, 35, 35, 40, 40],
    [25, 25, 30, 30, 35, 35, 40, 40, 45],
    [25, 30, 30, 35, 35, 40, 40, 45, 45],
    [30, 30, 35, 35, 40, 40, 45, 45, 50],
    [30, 35, 35, 40, 40, 45, 45, 50, 50],
    [35, 35, 40, 40, 45, 45, 50, 50, 55],
    [35, 40, 40, 45, 45, 50, 50, 55, 55],
    [40, 40, 45, 45, 50, 50, 55, 55, 60],
    [40, 45, 45, 50, 50, 55, 55, 60, 60],
  ];
  table.forEach((row, w) => {
    row.forEach((expected, i) => {
      assert.equal(focusMax(i + 2, w + 2), expected, `INT ${i + 2} VONT ${w + 2}`);
    });
  });
});

test("descanso recupera INT + VONT e +5 com Concentração", () => {
  assert.equal(restRecovery(6, 4), 10);
  assert.equal(restRecovery(6, 4, true), 15);
});

test("sucesso exige superar a CD, empate configurável", () => {
  assert.equal(isSuccess(14, 13), true);
  assert.equal(isSuccess(13, 13), false);
  assert.equal(isSuccess(13, 13, true), true);
});

test("fumble = 1 natural e falha", () => {
  assert.equal(isFumble(1, false), true);
  assert.equal(isFumble(1, true), false);
  assert.equal(isFumble(2, false), false);
});

test("dano na Complexidade desconta Ofuscação e não fica negativo", () => {
  assert.deepEqual(applyClueDamage(25, 10, 2), { dealt: 8, value: 17, solved: false });
  assert.deepEqual(applyClueDamage(25, 1, 4), { dealt: 0, value: 25, solved: false });
  assert.deepEqual(applyClueDamage(5, 12, 0), { dealt: 12, value: 0, solved: true });
});

test("dia e tentativa diária", () => {
  assert.equal(dayIndex(86400 * 3 + 100, 0, true), 3);
  assert.equal(dayIndex(86400 * 3, 2, true), 5);
  assert.equal(dayIndex(86400 * 3, 2, false), 2);
  const clue = { attempts: [{ actorUuid: "Actor.a", day: 4 }] };
  assert.equal(attemptedOnDay(clue, "Actor.a", 4), true);
  assert.equal(attemptedOnDay(clue, "Actor.a", 5), false);
  assert.equal(attemptedOnDay(clue, "Actor.b", 4), false);
});

test("pista nova herda o preset do tipo", () => {
  const c = normalizeClue({ type: "autopsy" }, () => "id1");
  assert.equal(c.id, "id1");
  assert.deepEqual(c.skills, ["Paramedic", "role:Surgery Skill"]);
  assert.equal(c.damage, "4d6");
  assert.equal(c.focusDamage, "3d6");
  assert.equal(c.fumbleEffect, "penalty");
  assert.equal(c.fumblePenalty, -4);
  assert.equal(c.state, "hidden");
});

test("lista de perícias aceita texto separado por vírgula", () => {
  assert.deepEqual(parseSkillList("Accounting, Bureaucracy ,, "), ["Accounting", "Bureaucracy"]);
});

test("mistério normalizado com padrões e Complexidade limitada", () => {
  const m = normalizeMystery({ difficulty: "easy", complexity: { value: 99 } });
  assert.deepEqual(m.complexity, { max: 25, value: 25 });
  assert.equal(m.status, "active");
  const solved = normalizeMystery({ complexity: { max: 50, value: 0 } });
  assert.equal(solved.status, "solved");
});

test("trocar dificuldade preserva o progresso", () => {
  assert.deepEqual(complexityForDifficulty({ max: 50, value: 50 }, "challenging"), { max: 100, value: 100 });
  assert.deepEqual(complexityForDifficulty({ max: 50, value: 30 }, "challenging"), { max: 100, value: 80 });
});
