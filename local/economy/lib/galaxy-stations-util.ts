import * as fs from "fs";

/** Spansh galaxy dump station economies use PascalCase keys and whole-number percents. */
export const GALAXY_TO_RC_ECONOMY: Record<string, string> = {
  Agriculture: "agriculture",
  Extraction: "extraction",
  "High Tech": "hightech",
  Industrial: "industrial",
  Military: "military",
  Refinery: "refinery",
  Terraforming: "terraforming",
  Tourism: "tourism",
};

export const RC_ECONOMY_KEYS = [
  "agriculture",
  "extraction",
  "hightech",
  "industrial",
  "military",
  "refinery",
  "terraforming",
  "tourism",
  "service",
] as const;

export type RcEconomyKey = (typeof RC_ECONOMY_KEYS)[number];

export interface GalaxyStationEconomy {
  marketId: number;
  name: string;
  updated: string;
  economies: Partial<Record<RcEconomyKey, number>>;
}

export const parseSpanshUpdated = (updated: string): number =>
  new Date(updated.replace(" ", "T").replace(/\+00$/, "Z")).getTime();

export const isSpanshFresh = (updated: string, maxAgeMs: number): boolean => {
  const ms = parseSpanshUpdated(updated);
  return Number.isFinite(ms) && Date.now() - ms <= maxAgeMs;
};

export const normalizeGalaxyEconomies = (
  raw: Record<string, number> | null | undefined,
): Partial<Record<RcEconomyKey, number>> => {
  if (!raw) return {};
  const out: Partial<Record<RcEconomyKey, number>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const rcKey = GALAXY_TO_RC_ECONOMY[key];
    if (rcKey && typeof value === "number") {
      out[rcKey as RcEconomyKey] = value;
    }
  }
  return out;
};

/** Stream-search needle in a huge JSON file; returns global byte index. */
export const findByteOffset = (filePath: string, needle: string): number => {
  const buf = Buffer.from(needle);
  const fd = fs.openSync(filePath, "r");
  const chunkSize = 8 * 1024 * 1024;
  const chunk = Buffer.alloc(chunkSize);
  let offset = 0;
  let carry = Buffer.alloc(0);

  try {
    while (true) {
      const n = fs.readSync(fd, chunk, 0, chunkSize, offset);
      if (n <= 0) return -1;
      const merged = Buffer.concat([carry, chunk.subarray(0, n)]);
      const idx = merged.indexOf(buf);
      if (idx >= 0) {
        return offset - carry.length + idx;
      }
      carry = merged.subarray(Math.max(0, merged.length - buf.length - 32));
      offset += n;
    }
  } finally {
    fs.closeSync(fd);
  }
};

/** Brace-balance parse one JSON object starting at byte offset. */
export const readJsonObjectAt = (filePath: string, objectStart: number): unknown => {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { start: objectStart, highWaterMark: 1024 * 1024 });
    let json = "";
    let depth = 0;
    let started = false;

    stream.on("data", (chunk: Buffer) => {
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
    stream.on("end", () => reject(new Error("Incomplete JSON object")));
  });
};

export const extractSystemAtName = async (
  filePath: string,
  systemName: string,
  systemId64?: number,
): Promise<unknown> => {
  const needles: string[] = [];
  if (systemId64 !== undefined) {
    needles.push(`"id64":${systemId64},"name":"${systemName}"`);
  }
  needles.push(`"name":"${systemName}"`);

  let matchIndex = -1;
  for (const needle of needles) {
    matchIndex = findByteOffset(filePath, needle);
    if (matchIndex >= 0) break;
  }
  if (matchIndex < 0) {
    throw new Error(`System ${systemName} not found in ${filePath}`);
  }

  const readBack = Math.min(matchIndex, 8);
  const backBuf = Buffer.alloc(readBack);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, backBuf, 0, readBack, matchIndex - readBack);
  fs.closeSync(fd);
  const relBrace = backBuf.toString("utf8").lastIndexOf("{");
  const objectStart = matchIndex - readBack + relBrace;
  return readJsonObjectAt(filePath, objectStart);
};

export interface GalaxyBody {
  stations?: {
    name: string;
    id: number;
    updateTime?: string;
    economies?: Record<string, number>;
  }[];
  bodies?: GalaxyBody[];
}

export interface GalaxySystem {
  name: string;
  id64: number;
  bodies?: GalaxyBody[];
}

export const collectGalaxyStations = (system: GalaxySystem): GalaxyStationEconomy[] => {
  const out: GalaxyStationEconomy[] = [];
  const walk = (bodies: GalaxyBody[] | undefined) => {
    for (const bod of bodies ?? []) {
      for (const st of bod.stations ?? []) {
        if (!st.id || !st.economies) continue;
        out.push({
          marketId: st.id,
          name: st.name,
          updated: st.updateTime ?? "",
          economies: normalizeGalaxyEconomies(st.economies),
        });
      }
      walk(bod.bodies);
    }
  };
  walk(system.bodies);
  return out;
};
