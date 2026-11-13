/**
 * Constantes e tabelas do sistema de investigação "Did Someone Say Murder?"
 * (R. Talsorian Games, set/2024). Os números vêm das tabelas do PDF.
 */

export const MODULE_ID = "cpr-investigation";
export const SYSTEM_ID = "cyberpunk-red-core";
export const SOCKET_NAME = `module.${MODULE_ID}`;
export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;

export const FLAG_MYSTERY = "mystery";
export const FLAG_FOCUS = "focus";
export const FLAG_CARD = "card";

/** Id do "sheet" de JournalEntry que abre o painel do mistério. */
export const SHEET_CLASS_NAME = "MysteryJournalSheet";
export const SHEET_CLASS_ID = `${MODULE_ID}.${SHEET_CLASS_NAME}`;

/** Complexidade por dificuldade (p. 4). */
export const COMPLEXITY = {
  easy: 25,
  average: 50,
  challenging: 100,
  difficult: 150,
  legendary: 200,
};

/** Ofuscação: funciona como o SP da pista (p. 4). */
export const OBFUSCATION = {
  none: 0,
  light: 2,
  heavy: 4,
  nearTotal: 6,
};

/** Prefixo para habilidades de Role roláveis (ex.: Cirurgia do Medtech). */
export const ROLE_PREFIX = "role:";
/** Curinga para "uma Ciência apropriada". */
export const SCIENCE_WILDCARD = "Science (*)";

/**
 * Efeitos de fumble suportados:
 *  - none: nada além do dano de Foco
 *  - note: só anuncia a consequência (ex.: o alvo do Tailing fica agressivo)
 *  - penalty: aplica uma penalidade aos próximos testes desta pista (Autópsia: -4)
 *  - blocked: a pista fica bloqueada até o mestre liberar (amostra/aparelho destruído, Interrogatório)
 */
export const FUMBLE_EFFECTS = ["none", "note", "penalty", "blocked"];

/** Exemplos de pista (p. 5). Os nomes de perícia seguem os itens do sistema (em inglês). */
export const CLUE_TYPES = {
  auditing: { skills: ["Accounting", "Bureaucracy"], damage: "3d6", focusDamage: "2d6", fumbleEffect: "none" },
  autopsy: {
    skills: ["Paramedic", `${ROLE_PREFIX}Surgery Skill`],
    damage: "4d6",
    focusDamage: "3d6",
    fumbleEffect: "penalty",
    penalty: -4,
  },
  chemical: { skills: ["Basic Tech", SCIENCE_WILDCARD], damage: "3d6", focusDamage: "2d6", fumbleEffect: "blocked" },
  deciphering: { skills: ["Cryptography"], damage: "2d6", focusDamage: "1d6", fumbleEffect: "none" },
  digital: { skills: ["Electronics/Security Tech"], damage: "4d6", focusDamage: "3d6", fumbleEffect: "blocked" },
  forensics: { skills: ["Criminology", "Deduction"], damage: "4d6", focusDamage: "3d6", fumbleEffect: "blocked" },
  gossip: { skills: ["Conversation", "Persuasion", "Streetwise"], damage: "2d6", focusDamage: "1d6", fumbleEffect: "none" },
  interrogation: {
    skills: ["Human Perception", "Interrogation"],
    damage: "3d6",
    focusDamage: "2d6",
    fumbleEffect: "blocked",
  },
  observation: { skills: ["Human Perception", "Perception"], damage: "2d6", focusDamage: "1d6", fumbleEffect: "none" },
  research: { skills: ["Education", "Library Search"], damage: "2d6", focusDamage: "1d6", fumbleEffect: "none" },
  tailing: { skills: ["Stealth"], damage: "3d6", focusDamage: "2d6", fumbleEffect: "note" },
  tracking: { skills: ["Tracking"], damage: "2d6", focusDamage: "1d6", fumbleEffect: "none" },
  custom: { skills: [], damage: "2d6", focusDamage: "1d6", fumbleEffect: "none" },
};

/** Exemplos de obstáculo (p. 7). "redHerring" vira uma pista marcada como falsa, não um obstáculo. */
export const OBSTACLE_TYPES = [
  "authority",
  "cultural",
  "digital",
  "distraction",
  "fatigue",
  "legal",
  "location",
  "misdirection",
  "missingClue",
  "socialEngineering",
  "technological",
  "territory",
  "custom",
];

export const CLUE_STATES = ["hidden", "available", "collected", "debunked", "blocked"];
export const OBSTACLE_STATES = ["hidden", "active", "resolved"];

/** Regras fixas do PDF. */
export const HINT_DV = 15; // Dedução CD 15 para pedir dica (p. 6)
export const HINT_FOCUS_DAMAGE = "1d6";
export const OBSTACLE_FOCUS_SUCCESS = "1d6"; // superou o obstáculo (p. 6)
export const OBSTACLE_FOCUS_FAILURE = "2d6"; // falhou contra o obstáculo
export const CONCENTRATION_DV = 15; // descanso: Concentração CD 15 dá +5 (p. 3)
export const CONCENTRATION_BONUS = 5;
export const FUMBLE_NATURAL = 1;

export const FOCUS_LOG_MAX = 50;
export const SECONDS_PER_DAY = 86400;
