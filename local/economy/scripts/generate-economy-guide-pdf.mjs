import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";
import { marked } from "marked";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const mdPath = path.join(repoRoot, "docs/economy-model-guide.md");
const pdfPath = path.join(repoRoot, "local/docs/economy-model-guide.pdf");
const htmlPreviewPath = path.join(repoRoot, "local/docs/economy-model-guide.print.html");

const PRINT_STYLES = `
    body {
      font-family: "Segoe UI", Calibri, sans-serif;
      max-width: 780px;
      margin: 0 auto;
      padding: 24px 28px;
      line-height: 1.55;
      color: #1a1a1a;
      font-size: 11pt;
    }
    h1 { font-size: 22pt; border-bottom: 2px solid #333; padding-bottom: 0.25em; margin-top: 0; }
    h2 { font-size: 15pt; margin-top: 1.4em; page-break-after: avoid; }
    h3 { font-size: 12pt; margin-top: 1.1em; page-break-after: avoid; }
    p, li { orphans: 3; widows: 3; }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 9.5pt; page-break-inside: avoid; }
    th, td { border: 1px solid #bbb; padding: 0.4em 0.55em; text-align: left; vertical-align: top; }
    th { background: #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    code { background: #f2f2f2; padding: 0.1em 0.25em; font-size: 0.92em; }
    pre code { display: block; padding: 0; background: none; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
    strong { font-weight: 600; }

    .economy-flow {
      margin: 1.2em 0 1.4em;
      page-break-inside: avoid;
    }
    .economy-flow__sources {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
    }
    .economy-flow__box {
      border: 1.5px solid #888;
      border-radius: 6px;
      padding: 10px 12px;
      background: #fafafa;
      font-size: 9.5pt;
    }
    .economy-flow__box--own { border-color: #4a7c59; background: #f4faf6; }
    .economy-flow__box--strong { border-color: #3d6b8c; background: #f2f7fb; }
    .economy-flow__box--weak { border-color: #8c6b3d; background: #fbf8f2; }
    .economy-flow__title {
      margin: 0 0 0.45em;
      font-weight: 600;
      font-size: 9.5pt;
      line-height: 1.3;
    }
    .economy-flow__box ul {
      margin: 0;
      padding-left: 1.1em;
    }
    .economy-flow__box li {
      margin: 0.2em 0;
    }
    .economy-flow__arrows {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      text-align: center;
      font-size: 16pt;
      line-height: 1;
      color: #555;
      margin: 6px 0 4px;
    }
    .economy-flow__result {
      margin: 0 auto;
      max-width: 220px;
      text-align: center;
      font-weight: 700;
      font-size: 11pt;
      padding: 10px 16px;
      border: 2px solid #333;
      border-radius: 6px;
      background: #fff;
    }
`;

const md = fs.readFileSync(mdPath, "utf8");
if (md.includes("```mermaid")) {
  console.error("Guide still contains a mermaid fence — update economy-model-guide.md first.");
  process.exit(1);
}
if (!md.includes("economy-flow")) {
  console.error("Guide is missing the economy-flow HTML diagram.");
  process.exit(1);
}

let body = marked.parse(md);
if (body.includes("flowchart TB")) {
  console.error("Parsed HTML still contains raw mermaid source.");
  process.exit(1);
}
if (!body.includes("economy-flow")) {
  console.error("Parsed HTML is missing economy-flow markup.");
  process.exit(1);
}

body = body.replace(
  /<a href="\.\/economy-model\.md">([^<]*)<\/a>/g,
  "$1 (companion: economy-model.md)",
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>How colonization economies work</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rc-guide-pdf-"));
const htmlPath = path.join(tmpDir, "economy-model-guide.html");
const pdfTmpPath = path.join(tmpDir, "economy-model-guide.pdf");
fs.writeFileSync(htmlPath, html, "utf8");
fs.writeFileSync(htmlPreviewPath, html, "utf8");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.pdf({
    path: pdfTmpPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  });
} finally {
  await browser.close();
}

if (!fs.existsSync(pdfTmpPath) || fs.statSync(pdfTmpPath).size < 1000) {
  console.error("PDF generation failed — temp file missing or too small.");
  process.exit(1);
}

try {
  fs.copyFileSync(pdfTmpPath, pdfPath);
} catch (err) {
  console.error(`Could not overwrite ${pdfPath} — close it in your PDF viewer and retry.`);
  console.error(err.message);
  const fallback = path.join(repoRoot, "local/docs/economy-model-guide.NEW.pdf");
  fs.copyFileSync(pdfTmpPath, fallback);
  console.error(`Wrote fallback: ${fallback}`);
  process.exit(1);
}

const stat = fs.statSync(pdfPath);
console.log(`Wrote ${pdfPath} (${stat.size} bytes, ${stat.mtime.toISOString()})`);
console.log(`Preview HTML: ${htmlPreviewPath}`);
