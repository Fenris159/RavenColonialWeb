const fs = require("fs");
const offset = Number(process.argv[2] || 1984711402);
const len = Number(process.argv[3] || 2500);
const fd = fs.openSync(process.argv[4], "r");
const buf = Buffer.alloc(len);
fs.readSync(fd, buf, 0, len, offset - 400);
fs.closeSync(fd);
console.log(buf.toString("utf8"));
