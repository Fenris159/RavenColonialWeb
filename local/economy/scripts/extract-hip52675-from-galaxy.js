/**
 * One-off: extract HIP 52675 from Spansh galaxy_stations.json dump and compare to RC model.
 * Usage: node src/dev/economy/extract-hip52675-from-galaxy.js [path-to-galaxy_stations.json]
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const SYSTEM_ID64 = 319731861851;
const API = "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net/api/v2";
const FOUR_MONTHS_MS = 120 * 24 * 60 * 60 * 1000;
const ECONOMY_KEYS = [
  "agriculture",
  "extraction",
  "hightech",
  "industrial",
  "military",
  "refinery",
  "terraforming",
  "tourism",
  "service",
];

const dumpPath =
  process.argv[2] ||
  path.join(os.homedir(), "Downloads", "galaxy_stations.json");

const parseUpdated = updated => {
  if (!updated) return NaN;
  return new Date(updated.replace(" ", "T").replace(/\+00$/, "Z")).getTime();
};

const isFresh = updated => {
  const ms = parseUpdated(updated);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= FOUR_MONTHS_MS;
};

/** Stream-search for system object start, then brace-balance parse one JSON value. */
function extractSystemById64(filePath, id64) {
  const needle = `"id64":${id64}`;
  const fd = fs.openSync(filePath, "r");
  const chunkSize = 4 * 1024 * 1024;
  const buf = Buffer.alloc(chunkSize);
  let fileOffset = 0;
  let carry = "";
  let globalIndex = 0;
  let matchIndex = -1;

  while (true) {
    const bytesRead = fs.readSync(fd, buf, 0, chunkSize, fileOffset);
    if (bytesRead <= 0) break;
    const text = carry + buf.toString("utf8", 0, bytesRead);
    const local = text.indexOf(needle);
    if (local >= 0) {
      matchIndex = globalIndex + local;
      break;
    }
    carry = text.slice(-needle.length - 32);
    globalIndex += bytesRead;
    fileOffset += bytesRead;
  }
  fs.closeSync(fd);

  if (matchIndex < 0) {
    throw new Error(`System id64 ${id64} not found in dump`);
  }

  // Walk back to opening brace of this system object (dump uses tab-indented objects in array).
  const readBack = Math.min(matchIndex, 512);
  const backBuf = Buffer.alloc(readBack);
  const objectStartGuess = matchIndex - readBack;
  const backFd = fs.openSync(filePath, "r");
  fs.readSync(backFd, backBuf, 0, readBack, Math.max(0, objectStartGuess));
  fs.closeSync(backFd);
  const backText = backBuf.toString("utf8");
  const relBrace = backText.lastIndexOf("{");
  const objectStart = Math.max(0, objectStartGuess) + relBrace;

  // Read forward with brace balance.
  const stream = fs.createReadStream(filePath, { start: objectStart, highWaterMark: 1024 * 1024 });
  let json = "";
  let depth = 0;
  let started = false;

  return new Promise((resolve, reject) => {
    stream.on("data", chunk => {
      const s = chunk.toString("utf8");
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (!started) {
          if (ch === "{") {
            started = true;
            depth = 1;
            json = "{";
          }
          continue;
        }
        json += ch;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            stream.destroy();
            try {
              resolve(JSON.parse(json));
            } catch (e) {
              reject(e);
            }
            return;
          }
        }
      }
    });
    stream.on("error", reject);
    stream.on("end", () => reject(new Error("Incomplete JSON while parsing system object")));
  });
}

/** Flatten stations from Spansh system tree (orbital + surface bodies). */
function collectStations(system) {
  const out = [];
  const walkBodies = bodies => {
    for (const bod of bodies || []) {
      for (const st of bod.stations || []) {
        out.push({
          marketId: st.marketId ?? st.id,
          name: st.name,
          updated: st.updateTime ?? st.updated ?? system.date,
          economies: st.economies ?? st.economy ?? null,
          bodyName: bod.name,
        });
      }
      if (bod.bodies) walkBodies(bod.bodies);
    }
  };
  walkBodies(system.bodies);
  return out;
}

async function main() {
  if (!fs.existsSync(dumpPath)) {
    console.error("Dump not found:", dumpPath);
    process.exit(1);
  }

  console.log("Extracting system", SYSTEM_ID64, "from", dumpPath);
  const system = await extractSystemById64(dumpPath, SYSTEM_ID64);
  console.log("System:", system.name, "stations in tree:", collectStations(system).length);

  const outDir = path.join(os.tmpdir(), "hip52675-galaxy");
  fs.mkdirSync(outDir, { recursive: true });
  const systemPath = path.join(outDir, "galaxy-system.json");
  fs.writeFileSync(systemPath, JSON.stringify(system, null, 2));

  const resp = await fetch(`${API}/system/${SYSTEM_ID64}`);
  if (!resp.ok) throw new Error(`RC API ${resp.status}`);
  const sys = await resp.json();
  const sysPath = path.join(os.tmpdir(), "hip52675-sys.json");
  fs.writeFileSync(sysPath, JSON.stringify(sys));

  const spanshResp = await fetch(`${API}/system/${SYSTEM_ID64}/spanshEconomies`);
  const spanshApi = spanshResp.ok ? await spanshResp.json() : [];

  console.log("\nRC sites:", sys.sites?.filter(s => s.status === "complete").length);
  console.log("Spansh API entries:", spanshApi.length);

  // Dynamic import for TS - use child process to run comparison via jest or compile
  console.log("\nWrote", systemPath);
  console.log("Wrote", sysPath);
  console.log("Run: npx react-scripts test --watchAll=false --testPathPattern=verify-hip52675-galaxy");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
