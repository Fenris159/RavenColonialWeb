import * as fs from "fs";
import {
  GALAXY_TO_RC_ECONOMY,
  type GalaxyStationEconomy,
  type RcEconomyKey,
  normalizeGalaxyEconomies,
} from "./galaxy-stations-util";

const STATION_BLOCK_RE =
  /"name":"([^"]+)","id":(\d+),"updateTime":"([^"]+)"[\s\S]*?"economies":\{([^}]*)\}/g;

const parseEconomyBlob = (blob: string): Partial<Record<RcEconomyKey, number>> => {
  const raw: Record<string, number> = {};
  const pairRe = /"([^"]+)":(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(blob)) !== null) {
    raw[m[1]] = Number(m[2]);
  }
  return normalizeGalaxyEconomies(raw);
};

/** Fallback when full JSON parse truncates: scan the system's byte range in the dump. */
export const extractGalaxyStationsInRange = (
  filePath: string,
  rangeStart: number,
  rangeEnd: number,
): GalaxyStationEconomy[] => {
  const fd = fs.openSync(filePath, "r");
  const len = rangeEnd - rangeStart;
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, rangeStart);
  fs.closeSync(fd);
  const text = buf.toString("utf8");

  const out: GalaxyStationEconomy[] = [];
  let m: RegExpExecArray | null;
  while ((m = STATION_BLOCK_RE.exec(text)) !== null) {
    out.push({
      marketId: Number(m[2]),
      name: m[1],
      updated: m[3],
      economies: parseEconomyBlob(m[4]),
    });
  }
  return out;
};

export const findGalaxySystemRange = (
  filePath: string,
  systemName: string,
  systemId64: number,
): { start: number; end: number } => {
  const startNeedle = `"id64":${systemId64}`;
  const startIdx = (() => {
    const fd = fs.openSync(filePath, "r");
    const chunkSize = 8 * 1024 * 1024;
    const chunk = Buffer.alloc(chunkSize);
    let offset = 0;
    let carry = "";
    while (true) {
      const n = fs.readSync(fd, chunk, 0, chunkSize, offset);
      if (n <= 0) break;
      const text = carry + chunk.toString("utf8", 0, n);
      const local = text.indexOf(startNeedle);
      if (local >= 0) {
        fs.closeSync(fd);
        return offset - carry.length + local;
      }
      carry = text.slice(-startNeedle.length - 64);
      offset += n;
    }
    fs.closeSync(fd);
    return -1;
  })();

  if (startIdx < 0) {
    throw new Error(`System id64 ${systemId64} not found`);
  }

  const readBack = 16;
  const backBuf = Buffer.alloc(readBack);
  const backFd = fs.openSync(filePath, "r");
  fs.readSync(backFd, backBuf, 0, readBack, Math.max(0, startIdx - readBack));
  fs.closeSync(backFd);
  const backText = backBuf.toString("utf8");
  const relBrace = backText.lastIndexOf("{");
  const start = startIdx - readBack + relBrace;

  const fd = fs.openSync(filePath, "r");
  const scanLen = 12 * 1024 * 1024;
  const buf = Buffer.alloc(scanLen);
  fs.readSync(fd, buf, 0, scanLen, start);
  fs.closeSync(fd);
  const rel = buf.toString("utf8").indexOf('\n\t{"id64":', 1000);
  const end = rel > 0 ? start + rel : start + scanLen;
  return { start, end };
};
