/**
 * Refresh RC + Spansh fixtures for economy regression tests.
 *
 * 1. Edit local/economy/fixtures/systems.manifest.json — add systems (slug, name, id64).
 * 2. Optional: set galaxyDumpPath to your Spansh galaxy_stations.json for dump-sourced rows.
 * 3. Run:
 *      node local/economy/scripts/refresh-system-fixtures.js
 *      node local/economy/scripts/refresh-system-fixtures.js --source=api
 *      node local/economy/scripts/refresh-system-fixtures.js --source=galaxy
 *      node local/economy/scripts/refresh-system-fixtures.js --slug=synuefai-cxv-c18-6
 *      node local/economy/scripts/refresh-system-fixtures.js --clear-temp
 *
 * Writes per system:
 *   local/economy/fixtures/systems/{slug}/rc-sys.json
 *   local/economy/fixtures/systems/{slug}/spansh-stations.json
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "fixtures", "systems.manifest.json");
const SYSTEMS_DIR = path.join(ROOT, "fixtures", "systems");

const GALAXY_TO_RC = {
  Agriculture: "agriculture",
  Extraction: "extraction",
  "High Tech": "hightech",
  Industrial: "industrial",
  Military: "military",
  Refinery: "refinery",
  Terraforming: "terraforming",
  Tourism: "tourism",
};

const normalizeGalaxyEconomies = (raw) => {
  if (!raw) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const rc = GALAXY_TO_RC[key];
    if (rc && typeof value === "number") out[rc] = value;
  }
  return out;
};

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

const readManifest = () => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("Missing manifest:", MANIFEST_PATH);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
};

/** Matches local/economy/lib/extract-galaxy-stations-range.ts */
const findGalaxySystemRange = (filePath, systemId64) => {
  const startNeedle = `"id64":${systemId64}`;
  const fd = fs.openSync(filePath, "r");
  const chunkSize = 8 * 1024 * 1024;
  const chunk = Buffer.alloc(chunkSize);
  let offset = 0;
  let carry = "";
  let startIdx = -1;
  while (true) {
    const n = fs.readSync(fd, chunk, 0, chunkSize, offset);
    if (n <= 0) break;
    const text = carry + chunk.toString("utf8", 0, n);
    const local = text.indexOf(startNeedle);
    if (local >= 0) {
      startIdx = offset - carry.length + local;
      break;
    }
    carry = text.slice(-startNeedle.length - 64);
    offset += n;
  }
  fs.closeSync(fd);
  if (startIdx < 0) throw new Error(`id64 ${systemId64} not found in galaxy dump`);

  const readBack = 16;
  const backBuf = Buffer.alloc(readBack);
  const backFd = fs.openSync(filePath, "r");
  fs.readSync(backFd, backBuf, 0, readBack, Math.max(0, startIdx - readBack));
  fs.closeSync(backFd);
  const backText = backBuf.toString("utf8");
  const relBrace = backText.lastIndexOf("{");
  const start = startIdx - readBack + relBrace;

  const scanLen = 12 * 1024 * 1024;
  const buf = Buffer.alloc(scanLen);
  const scanFd = fs.openSync(filePath, "r");
  fs.readSync(scanFd, buf, 0, scanLen, start);
  fs.closeSync(scanFd);
  const rel = buf.toString("utf8").indexOf('\n\t{"id64":', 1000);
  const end = rel > 0 ? start + rel : start + scanLen;
  return { start, end };
};

const isPlayerMadeMarketId = (marketId) => {
  const s = String(marketId);
  return (
    s.startsWith("395") ||
    s.startsWith("396") ||
    s.startsWith("397") ||
    s.startsWith("42") ||
    s.startsWith("43")
  );
};

const extractGalaxyStationsInRange = (filePath, rangeStart, rangeEnd) => {
  const fd = fs.openSync(filePath, "r");
  const len = rangeEnd - rangeStart;
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, rangeStart);
  fs.closeSync(fd);
  const text = buf.toString("utf8");
  const re =
    /"name":"([^"]+)","id":(\d+),"updateTime":"([^"]+)"[\s\S]*?"economies":\{([^}]*)\}/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = {};
    const pairRe = /"([^"]+)":(\d+(?:\.\d+)?)/g;
    let p;
    while ((p = pairRe.exec(m[4])) !== null) raw[p[1]] = Number(p[2]);
    out.push({
      marketId: Number(m[2]),
      name: m[1],
      updated: m[3],
      economies: normalizeGalaxyEconomies(raw),
    });
  }
  return out;
};

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
};

const siteNameByMarketId = (sys, marketId) => {
  const site = (sys.sites || []).find((s) => s.marketId === marketId);
  return site?.name || `market:${marketId}`;
};

const spanshFromApi = (sys, apiRows) =>
  (apiRows || []).map((row) => ({
    marketId: Number(row.id),
    name: siteNameByMarketId(sys, Number(row.id)),
    updated: row.updated || new Date().toISOString().replace("T", " ").slice(0, 19) + "+00",
    economies: row.economies || {},
  }));

const clearTempCaches = () => {
  const patterns = [
    /^col285-/,
    /^synuefe/,
    /^synuefai/,
    /^hr4464/,
    /^ic1805/,
    /^hip52675/,
    /^wredguia/,
    /-sys\.json$/,
    /-spansh/,
    /-galaxy/,
    /-economy-compare/,
  ];
  let removed = 0;
  for (const file of fs.readdirSync(os.tmpdir())) {
    if (!patterns.some((re) => re.test(file))) continue;
    const full = path.join(os.tmpdir(), file);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        fs.rmSync(full, { recursive: true, force: true });
      } else {
        fs.unlinkSync(full);
      }
      removed++;
    } catch (err) {
      console.warn("Skip:", full, err.message);
    }
  }
  console.log(`Removed ${removed} temp cache path(s) from ${os.tmpdir()}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args.includes("--clear-temp")) {
    clearTempCaches();
    if (args.length === 1) return;
  }

  const manifest = readManifest();
  const sourceArg = args.find((a) => a.startsWith("--source="));
  const slugFilter = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
  const source = sourceArg?.split("=")[1] || (manifest.galaxyDumpPath ? "galaxy" : "api");
  const dumpPath =
    manifest.galaxyDumpPath ||
    path.join(os.homedir(), "Downloads", "galaxy_stations.json");

  if (!manifest.systems?.length) {
    console.log("No systems in manifest. Add entries to systems.manifest.json, for example:");
    console.log(JSON.stringify({
      slug: "synuefai-cxv-c18-6",
      name: "Synuefai CX-V c18-6",
      id64: 1732784263842,
    }, null, 2));
    process.exit(0);
  }

  const targets = slugFilter
    ? manifest.systems.filter((s) => s.slug === slugFilter)
    : manifest.systems;

  if (!targets.length) {
    console.error("No systems matched filter:", slugFilter);
    process.exit(1);
  }

  if (source === "galaxy" && !fs.existsSync(dumpPath)) {
    console.error("Galaxy dump not found:", dumpPath);
    console.error("Set galaxyDumpPath in manifest or pass --source=api");
    process.exit(1);
  }

  fs.mkdirSync(SYSTEMS_DIR, { recursive: true });

  for (const entry of targets) {
    const slug = entry.slug || slugify(entry.name);
    const id64 = entry.id64;
    const name = entry.name;
    if (!id64 || !name) {
      console.warn("Skip invalid entry (need name + id64):", entry);
      continue;
    }

    const outDir = path.join(SYSTEMS_DIR, slug);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\n[${slug}] Fetching RC save…`);
    const sys = await fetchJson(`${manifest.apiBase}/system/${id64}`);
    fs.writeFileSync(path.join(outDir, "rc-sys.json"), JSON.stringify(sys, null, 2));

    let stations;
    let spanshSource;
    if (source === "galaxy") {
      console.log(`[${slug}] Extracting from galaxy dump…`);
      const { start, end } = findGalaxySystemRange(dumpPath, id64);
      stations = extractGalaxyStationsInRange(dumpPath, start, end).filter((s) =>
        isPlayerMadeMarketId(s.marketId),
      );
      spanshSource = "galaxy-dump";
      console.log(`[${slug}] Galaxy byte range ${start}–${end} (${end - start} bytes)`);
    } else {
      console.log(`[${slug}] Fetching RC spanshEconomies API…`);
      const apiRows = await fetchJson(`${manifest.apiBase}/system/${id64}/spanshEconomies`);
      stations = spanshFromApi(sys, apiRows);
      spanshSource = "rc-api";
    }

    const payload = {
      source: spanshSource,
      fetchedAt: new Date().toISOString(),
      systemName: name,
      id64,
      stationCount: stations.length,
      stations,
    };
    fs.writeFileSync(
      path.join(outDir, "spansh-stations.json"),
      JSON.stringify(payload, null, 2),
    );
    console.log(`[${slug}] Wrote ${stations.length} Spansh rows → ${outDir}`);
  }

  console.log("\nDone. Run: npm run test:economy -- --testPathPattern=verify-systems");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
