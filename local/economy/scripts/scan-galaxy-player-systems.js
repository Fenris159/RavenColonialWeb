/**
 * Stream galaxy_stations.json and rank systems by fresh player-made station count.
 * Player marketId prefixes: 395, 396, 397, 42, 43 (string prefix on journal id).
 *
 * Usage: node src/dev/economy/scan-galaxy-player-systems.js [dumpPath] [topN]
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const dumpPath =
  process.argv[2] || path.join(os.homedir(), "Downloads", "galaxy_stations.json");
const topN = Number(process.argv[3] || 25);
const chunkSize = 16 * 1024 * 1024;
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
const now = Date.now();

const isPlayerMadeMarketId = (id) => {
  const s = String(id);
  return (
    s.startsWith("395") ||
    s.startsWith("396") ||
    s.startsWith("397") ||
    s.startsWith("42") ||
    s.startsWith("43")
  );
};

const parseUpdated = (updated) => {
  const ms = new Date(updated.replace(" ", "T").replace(/\+00$/, "Z")).getTime();
  return Number.isFinite(ms) ? ms : NaN;
};

const isFresh = (updated) => {
  const ms = parseUpdated(updated);
  return Number.isFinite(ms) && now - ms <= THREE_MONTHS_MS;
};

const SYSTEM_SPLIT = /\n\t\{"id64":/g;
const SYSTEM_HEAD_RE = /^(\d+),"name":"([^"]+)"/;
const STATION_RE =
  /"name":"([^"]+)","id":(\d+),"updateTime":"([^"]+)"[\s\S]*?"economies":\{/g;

const scoreSystem = (chunk) => {
  const head = chunk.indexOf('"id64":');
  if (head < 0) return null;
  const after = chunk.slice(head + 7);
  const hm = after.match(SYSTEM_HEAD_RE);
  if (!hm) return null;
  const id64 = Number(hm[1]);
  const name = hm[2];
  let playerFresh = 0;
  let playerTotal = 0;
  let stale = 0;
  STATION_RE.lastIndex = 0;
  let m;
  while ((m = STATION_RE.exec(chunk)) !== null) {
    const id = Number(m[2]);
    if (!isPlayerMadeMarketId(id)) continue;
    playerTotal++;
    if (isFresh(m[3])) playerFresh++;
    else stale++;
  }
  if (playerFresh === 0) return null;
  return { id64, name, playerFresh, playerTotal, stale };
};

const top = [];
const pushTop = (row) => {
  top.push(row);
  top.sort((a, b) => b.playerFresh - a.playerFresh || b.playerTotal - a.playerTotal);
  if (top.length > topN) top.length = topN;
};

const run = () => {
  if (!fs.existsSync(dumpPath)) {
    console.error("Missing dump:", dumpPath);
    process.exit(1);
  }
  const stat = fs.statSync(dumpPath);
  const fd = fs.openSync(dumpPath, "r");
  let offset = 0;
  let carry = "";
  let systemsSeen = 0;
  const t0 = Date.now();

  while (offset < stat.size) {
    const n = Math.min(chunkSize, stat.size - offset);
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, offset);
    offset += n;
    const text = carry + buf.toString("utf8");
    SYSTEM_SPLIT.lastIndex = 0;
    const splits = [];
    let sm;
    while ((sm = SYSTEM_SPLIT.exec(text)) !== null) splits.push(sm.index);
    if (splits.length === 0) {
      carry = text.slice(-64);
      continue;
    }
    let prev = 0;
    for (const idx of splits) {
      const chunk = text.slice(prev, idx);
      if (chunk.includes('"id64":')) {
        const row = scoreSystem(chunk);
        systemsSeen++;
        if (row) pushTop(row);
      }
      prev = idx + 1;
    }
    carry = text.slice(prev);
    if (offset % (256 * 1024 * 1024) < chunkSize) {
      const pct = ((100 * offset) / stat.size).toFixed(1);
      process.stderr.write(`\r${pct}% scanned, systems ${systemsSeen}, top fresh ${top[0]?.playerFresh ?? 0}   `);
    }
  }
  if (carry.includes('"id64":')) {
    const row = scoreSystem(carry);
    systemsSeen++;
    if (row) pushTop(row);
  }
  fs.closeSync(fd);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  process.stderr.write(`\nDone in ${elapsed}s, systems scanned: ${systemsSeen}\n\n`);

  console.log(
    `Player marketId prefixes: 395*, 396*, 397*, 42*, 43* | Fresh window: 90 days | Dump: ${dumpPath}`,
  );
  console.log("Rank | System | id64 | fresh player | all player | stale player");
  top.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(4)} | ${r.name} | ${r.id64} | ${r.playerFresh} | ${r.playerTotal} | ${r.stale}`,
    );
  });
  if (top[0]) {
    const outPath = path.join(os.tmpdir(), "galaxy-top-player-systems.json");
    fs.writeFileSync(
      outPath,
      JSON.stringify({ scannedAt: new Date().toISOString(), top }, null, 2),
    );
    console.log("\nWrote", outPath);
  }
};

run();
