const fs = require("fs");
const path = require("path");
const os = require("os");

const dump = path.join(os.homedir(), "Downloads", "galaxy_stations.json");
const systemStart = 1980598972;
const scanMb = 25;
const fd = fs.openSync(dump, "r");
const buf = Buffer.alloc(scanMb * 1024 * 1024);
fs.readSync(fd, buf, 0, buf.length, systemStart);
fs.closeSync(fd);
const t = buf.toString("utf8");

// Next system in array starts with tab + { + "id64"
const nextTab = t.indexOf('\n\t{"id64":', 1000);
console.log("next system relative offset", nextTab, "absolute", nextTab > 0 ? systemStart + nextTab : "n/a");

const stationRegex =
  /"name":"([^"]+)","id":(\d+),"updateTime":"([^"]+)"[^}]*?"economies":\{([^}]+)\}/g;
let m;
let count = 0;
const escobar = [];
while ((m = stationRegex.exec(t)) !== null) {
  count++;
  if (m[1].includes("Escobar")) escobar.push(m);
}
console.log("regex stations", count);
console.log("escobar", escobar.length ? escobar[0].slice(1, 4) : "none");
