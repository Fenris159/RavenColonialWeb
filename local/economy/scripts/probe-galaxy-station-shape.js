const fs = require("fs");
const p = process.argv[2] || "C:/Users/Drew/AppData/Local/Temp/hip52675-system-line.txt";
const raw = fs.readFileSync(p, "utf8");
const keys = ["econom", "market", "Escobar", "HIP 52675", "stations"];
for (const k of keys) {
  const i = raw.indexOf(k);
  console.log(k, i >= 0 ? i : "missing");
}
const esc = raw.indexOf("Escobar");
if (esc >= 0) console.log("\n...", raw.substring(esc - 80, esc + 600));
const stIdx = raw.indexOf('"stations"');
if (stIdx >= 0) console.log("\nstations sample:", raw.substring(stIdx, stIdx + 800));
