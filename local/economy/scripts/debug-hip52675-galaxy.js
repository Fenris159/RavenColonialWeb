const fs = require("fs");
const path = require("path");
const os = require("os");

const dump = path.join(os.homedir(), "Downloads", "galaxy_stations.json");

async function main() {
  const { extractSystemAtName, collectGalaxyStations } = require("./galaxy-stations-util.ts");
}

// Use compiled approach - duplicate minimal extract
const { findByteOffset, readJsonObjectAt, collectGalaxyStations } = (() => {
  const mod = require("ts-node");
  mod.register({ transpileOnly: true, compilerOptions: { module: "commonjs" } });
  return require("./galaxy-stations-util.ts");
})();

(async () => {
  const needle = '"name":"HIP 52675"';
  const idx = findByteOffset(dump, needle);
  console.log("offset", idx);
  const readBack = Math.min(idx, 256);
  const backBuf = Buffer.alloc(readBack);
  const fd = fs.openSync(dump, "r");
  fs.readSync(fd, backBuf, 0, readBack, idx - readBack);
  fs.closeSync(fd);
  const objectStart = idx - readBack + backBuf.toString("utf8").lastIndexOf("{");
  console.log("objectStart", objectStart);
  const system = await readJsonObjectAt(dump, objectStart);
  console.log("system keys", Object.keys(system));
  console.log("id64", system.id64, "name", system.name);
  const stations = collectGalaxyStations(system);
  console.log("stations with economies", stations.length);
  console.log(
    "has Escobar",
    stations.some(s => s.name === "Escobar Gateway"),
  );
  const esc = stations.find(s => s.name.includes("Escobar"));
  console.log("escobar", esc);
  // brute count station names in raw substring
  const raw = fs.readFileSync(dump, "utf8", { start: objectStart, end: objectStart + 50_000_000 });
})();
