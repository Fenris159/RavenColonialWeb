import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const replacements = [
  // economy modules: parent src imports
  [/from "\.\/site-data"/g, 'from "../site-data"'],
  [/from '\.\/site-data'/g, "from '../site-data'"],
  [/from "\.\/types"/g, 'from "../types"'],
  [/from '\.\/types'/g, "from '../types'"],
  [/from "\.\/types2"/g, 'from "../types2"'],
  [/from '\.\/types2'/g, "from '../types2'"],
  [/from '\.\/api\/v2-system'/g, "from '../api/v2-system'"],
  [/from "\.\/api\/v2-system"/g, 'from "../api/v2-system"'],
  // compare: system-model
  [/from "\.\/system-model2"/g, 'from "../system-model2"'],
  [/from '\.\/system-model2'/g, "from '../system-model2'"],
  // app consumers (order matters — specific paths first)
  [/from "\.\.\/\.\.\/economy-model2"/g, 'from "../../economy"'],
  [/from '\.\.\/\.\.\/economy-model2'/g, "from '../../economy'"],
  [/from "\.\.\/economy-model2"/g, 'from "../economy"'],
  [/from '\.\.\/economy-model2'/g, "from '../economy'"],
  [/from "\.\.\/\.\.\/economy-facility-registry"/g, 'from "../../economy/economy-facility-registry"'],
  [/from '\.\.\/\.\.\/economy-facility-registry'/g, "from '../../economy/economy-facility-registry'"],
  [/from "\.\.\/economy-facility-registry"/g, 'from "../economy/economy-facility-registry"'],
  [/from '\.\.\/economy-facility-registry'/g, "from '../economy/economy-facility-registry'"],
  [/from "\.\.\/\.\.\/system-model2"/g, 'from "../../economy/system-model2"'],
  [/from '\.\.\/\.\.\/system-model2'/g, "from '../../economy/system-model2'"],
  [/from "\.\.\/system-model2"/g, 'from "../economy/system-model2"'],
  [/from '\.\.\/system-model2'/g, "from '../economy/system-model2'"],
  [/from '\.\/system-model2'/g, "from './economy/system-model2'"],
  [/from "\.\.\/\.\.\/spansh-economy-resolve"/g, 'from "../../economy/compare/spansh-economy-resolve"'],
  [/from '\.\.\/\.\.\/spansh-economy-resolve'/g, "from '../../economy/compare/spansh-economy-resolve'"],
  [/from "\.\.\/spansh-economy-resolve"/g, 'from "../economy/compare/spansh-economy-resolve"'],
  [/from '\.\.\/spansh-economy-resolve'/g, "from '../economy/compare/spansh-economy-resolve'"],
  [/from "\.\.\/\.\.\/spansh-compare-reliability"/g, 'from "../../economy/compare/spansh-compare-reliability"'],
  [/from '\.\.\/\.\.\/spansh-compare-reliability'/g, "from '../../economy/compare/spansh-compare-reliability'"],
  [/from "\.\.\/spansh-compare-reliability"/g, 'from "../economy/compare/spansh-compare-reliability"'],
  [/from '\.\.\/spansh-compare-reliability'/g, "from '../economy/compare/spansh-compare-reliability'"],
  // local tests / lib
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-model2"/g, 'from "../../../src/economy"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-model2'/g, "from '../../../src/economy'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/system-model2"/g, 'from "../../../src/economy/system-model2"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/system-model2'/g, "from '../../../src/economy/system-model2'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-core"/g, 'from "../../../src/economy/economy-core"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-core'/g, "from '../../../src/economy/economy-core'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-documented"/g, 'from "../../../src/economy/economy-documented"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-documented'/g, "from '../../../src/economy/economy-documented'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-ag-heuristics"/g, 'from "../../../src/economy/economy-ag-heuristics"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-ag-heuristics'/g, "from '../../../src/economy/economy-ag-heuristics'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-ag-modifiers"/g, 'from "../../../src/economy/economy-ag-modifiers"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-ag-modifiers'/g, "from '../../../src/economy/economy-ag-modifiers'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-link-sources"/g, 'from "../../../src/economy/economy-link-sources"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-link-sources'/g, "from '../../../src/economy/economy-link-sources'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-weak-links"/g, 'from "../../../src/economy/economy-weak-links"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-weak-links'/g, "from '../../../src/economy/economy-weak-links'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/economy-facility-registry"/g, 'from "../../../src/economy/economy-facility-registry"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/economy-facility-registry'/g, "from '../../../src/economy/economy-facility-registry'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/spansh-economy-resolve"/g, 'from "../../../src/economy/compare/spansh-economy-resolve"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/spansh-economy-resolve'/g, "from '../../../src/economy/compare/spansh-economy-resolve'"],
  [/from "\.\.\/\.\.\/\.\.\/src\/spansh-compare-reliability"/g, 'from "../../../src/economy/compare/spansh-compare-reliability"'],
  [/from '\.\.\/\.\.\/\.\.\/src\/spansh-compare-reliability'/g, "from '../../../src/economy/compare/spansh-compare-reliability'"],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "node_modules" || name === ".git") continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|md)$/.test(name)) out.push(full);
  }
  return out;
}

const dirs = [
  path.join(repoRoot, "src"),
  path.join(repoRoot, "local"),
  path.join(repoRoot, "docs"),
];

let changed = 0;
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (file.includes("fix-economy-imports.mjs")) continue;
    let text = fs.readFileSync(file, "utf8");
    const orig = text;
    for (const [re, rep] of replacements) {
      text = text.replace(re, rep);
    }
    if (text !== orig) {
      fs.writeFileSync(file, text, "utf8");
      changed++;
      console.log(path.relative(repoRoot, file));
    }
  }
}
console.log(`Updated ${changed} files.`);
