/**
 * Gera o compêndio LevelDB a partir dos dados em tools/pack-data.mjs.
 * Uso: node tools/build-packs.mjs   (precisa de @foundryvtt/foundryvtt-cli 1.x)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { normalizeMystery } from "../scripts/rules.js";
import { MODULE_ID, SHEET_CLASS_ID, FLAG_MYSTERY } from "../scripts/constants.js";
import { GRAB_AND_SMASH, SOMEONE_STOLE_IT_FIRST, GUIDE } from "./pack-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "packs-src", "mysteries");
const dest = path.join(root, "packs", "mysteries");

const stats = { coreVersion: "12.331", systemId: "cyberpunk-red-core", systemVersion: "v0.92.4" };

function mysteryDoc({ _id, name, mystery }, sort) {
  const data = normalizeMystery(mystery, () => {
    throw new Error(`Id faltando em ${name}`);
  });
  return {
    _id,
    _key: `!journal!${_id}`,
    name,
    pages: [],
    folder: null,
    sort,
    ownership: { default: 0 },
    flags: { [MODULE_ID]: { [FLAG_MYSTERY]: data }, core: { sheetClass: SHEET_CLASS_ID } },
    _stats: stats,
  };
}

function guideDoc(sort) {
  return {
    _id: GUIDE._id,
    _key: `!journal!${GUIDE._id}`,
    name: GUIDE.name,
    folder: null,
    sort,
    ownership: { default: 0 },
    flags: {},
    _stats: stats,
    pages: GUIDE.pages.map((p) => ({
      ...p,
      _key: `!journal.pages!${GUIDE._id}.${p._id}`,
      ownership: { default: -1 },
      flags: {},
      _stats: stats,
    })),
  };
}

const docs = [guideDoc(0), mysteryDoc(GRAB_AND_SMASH, 100), mysteryDoc(SOMEONE_STOLE_IT_FIRST, 200)];
for (const d of docs) {
  if (!/^[a-zA-Z0-9]{16}$/.test(d._id)) throw new Error(`_id inválido: ${d._id}`);
}

fs.rmSync(src, { recursive: true, force: true });
fs.mkdirSync(src, { recursive: true });
for (const d of docs) fs.writeFileSync(path.join(src, `${d._id}.json`), `${JSON.stringify(d, null, 2)}\n`, "utf8");

fs.rmSync(dest, { recursive: true, force: true });
await compilePack(src, dest, { log: true });
console.log(`Compêndio gerado em ${path.relative(root, dest)} (${docs.length} documentos)`);
