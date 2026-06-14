const fs = require("fs");
const path = require("path");
const os = require("os");

const dump = path.join(os.homedir(), "Downloads", "galaxy_stations.json");
const start = 1980598972;
const mb = Number(process.argv[2] || 15);
const fd = fs.openSync(dump, "r");
const len = mb * 1024 * 1024;
const buf = Buffer.alloc(len);
fs.readSync(fd, buf, 0, len, start);
fs.closeSync(fd);
const t = buf.toString("utf8");
console.log("Escobar count", (t.match(/Escobar Gateway/g) || []).length);
console.log("Brunt count", (t.match(/Brunt Constructions/g) || []).length);
const i = t.indexOf('"name":"Escobar Gateway"');
console.log("escobar idx", i);
if (i >= 0) console.log(t.substring(i, i + 500));
