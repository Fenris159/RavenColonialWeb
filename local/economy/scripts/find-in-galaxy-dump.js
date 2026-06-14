const fs = require("fs");

const filePath = process.argv[2];
const needles = (process.argv.slice(3).length ? process.argv.slice(3) : [
  '"name":"HIP 52675"',
  '"id64":319731861851,',
  '"id64":319731861851',
]).map(s => Buffer.from(s));

const fd = fs.openSync(filePath, "r");
const chunkSize = 8 * 1024 * 1024;
const buf = Buffer.alloc(chunkSize);
let offset = 0;
let carry = Buffer.alloc(0);

while (true) {
  const n = fs.readSync(fd, buf, 0, chunkSize, offset);
  if (n <= 0) break;
  const chunk = Buffer.concat([carry, buf.subarray(0, n)]);
  for (const needle of needles) {
    const idx = chunk.indexOf(needle);
    if (idx >= 0) {
      const global = offset - carry.length + idx;
      console.log(needle.toString(), "at byte", global);
      const preview = Buffer.alloc(200);
      fs.readSync(fd, preview, 0, 200, global);
      console.log(preview.toString("utf8"));
      fs.closeSync(fd);
      process.exit(0);
    }
  }
  carry = chunk.subarray(Math.max(0, chunk.length - 64));
  offset += n;
}
fs.closeSync(fd);
console.log("not found");
