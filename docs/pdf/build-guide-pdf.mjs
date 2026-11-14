// Builds the OZ Studios–branded client PDF of the newsroom guide.
// Usage: node docs/pdf/build-guide-pdf.mjs   (needs Google Chrome or Microsoft Edge installed)
// Output: docs/Dhaka-Chronicles-Guide.pdf
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const guideDir = join(root, "docs/guide");
const md = readFileSync(join(guideDir, "README.md"), "utf8");
const logo = pathToFileURL(join(root, "design/brand/oz/oz-studio-logo.jpg")).href;
const dcLogo = pathToFileURL(join(root, "public/brand/logo-white-trim.png")).href;

// ---------------------------------------------------------------- tiny Markdown → HTML (covers what the guide uses)
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
function inline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img alt="${alt}" src="${pathToFileURL(join(guideDir, src)).href}">`)
    .replace(/\[([^\]]+)\]\((#[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}
function toHtml(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  let i = 0;
  const listStack = [];
  const closeLists = (depth = 0) => {
    while (listStack.length > depth) out.push(`</li></${listStack.pop().tag}>`);
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeLists();
      const level = m[1].length;
      const text = m[2];
      const cls = level === 1 ? ' class="part"' : level === 2 ? ' class="chapter"' : "";
      out.push(`<h${level} id="${slug(text)}"${cls}>${inline(text)}</h${level}>`);
      i++;
      continue;
    }
    if (/^---\s*$/.test(line)) {
      closeLists();
      i++;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      closeLists();
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if ((m = line.match(/^>\s?(.*)$/))) {
      closeLists();
      const q = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${q.filter(Boolean).map((p) => `<p>${inline(p)}</p>`).join("")}</blockquote>`);
      continue;
    }
    if ((m = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/))) {
      const depth = Math.floor(m[1].length / 2) + 1;
      const tag = /\d/.test(m[2]) ? "ol" : "ul";
      if (depth > listStack.length) {
        out.push(`<${tag}><li>`);
        listStack.push({ tag });
      } else {
        closeLists(depth);
        out.push("</li><li>");
      }
      out.push(inline(m[3]));
      i++;
      // continuation lines (indented text that is not a new item)
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s/.test(lines[i]) && !/^\s*\|/.test(lines[i])) out.push(" " + inline(lines[i++].trim()));
      continue;
    }
    if (/^\s{2,}\|/.test(line)) continue;
    closeLists();
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|>|\s*[-*]\s|\s*\d+\.\s|\s*\||---)/.test(lines[i])) para.push(lines[i++].trim());
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    else i++;
  }
  closeLists();
  return out.join("\n");
}

// Drop the guide's own title/intro block and Markdown table of contents; the PDF has its own cover and contents.
const body = md.slice(md.indexOf("# Part 1."));
const chapters = [...body.matchAll(/^##\s+(.*)$/gm)].map((m) => m[1]);
const today = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Dhaka Chronicles — Website & Newsroom Guide · OZ Studios</title>
<style>
@page {
  size: A4; margin: 20mm 16mm 18mm; background: #000;
  @top-left { content: "DHAKA CHRONICLES · WEBSITE & NEWSROOM GUIDE"; font: 6.5pt "Courier New", monospace; letter-spacing: .2em; color: #7a7a7a; }
  @top-right { content: "OZ STUDIO"; font: 6.5pt "Courier New", monospace; letter-spacing: .2em; color: #7a7a7a; }
  @bottom-left { content: "OZ STUDIO © 2026 · THE INTERNET, WITH INTENTION."; font: 6.5pt "Courier New", monospace; letter-spacing: .2em; color: #7a7a7a; }
  @bottom-right { content: counter(page, decimal-leading-zero) " / 48"; font: 6.5pt "Courier New", monospace; letter-spacing: .2em; color: #7a7a7a; }
}
@page :first { margin: 0; @top-left { content: none } @top-right { content: none } @bottom-left { content: none } @bottom-right { content: none } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #000; }
body { margin: 0; font: 10.5pt/1.65 "Helvetica Neue", Arial, sans-serif; color: #c9c9c6; background: #000; }
strong, h1, h2, h3, th { color: #f4f4f2; }
.mono, th, .kick { font-family: "Courier New", ui-monospace, monospace; letter-spacing: .2em; text-transform: uppercase; }
/* cover */
.cover { height: 297mm; background: #000; color: #f4f4f2; padding: 18mm 16mm; display: flex; flex-direction: column; position: relative; overflow: hidden; break-after: page; }
.cover .row { display: flex; justify-content: space-between; font-size: 8pt; color: #9a9a9a; border-bottom: .5pt solid #2a2a2a; padding-bottom: 6mm; }
.cover .row.bottom { border: 0; border-top: .5pt solid #2a2a2a; padding: 6mm 0 0; margin-top: auto; }
.cover .tag { margin-top: 26mm; font-size: 9.5pt; color: #b5b5b5; letter-spacing: .3em; }
.cover h1 { font-size: 46pt; line-height: .95; letter-spacing: -.04em; margin: 8mm 0 0; font-weight: 300; }
.cover h1 b { display: block; font-weight: 800; }
.cover .sub { margin-top: 10mm; font-size: 13pt; color: #cfcfcf; max-width: 120mm; }
.cover img, .back img { border: 0; border-radius: 0; margin: 0; max-height: none; }
.cover .dc { height: 13mm; width: auto; margin-top: 14mm; }
.cover .oz { position: absolute; right: 12mm; bottom: 34mm; width: 62mm; opacity: .95; }
.cover svg { position: absolute; left: 0; right: 0; bottom: 60mm; width: 100%; height: 50mm; }
/* contents */
.toc { break-after: page; }
.toc .kick { font-size: 7.5pt; color: #8a8a8a; border-bottom: .5pt solid #2a2a2a; padding-bottom: 4mm; margin-bottom: 10mm; }
.toc h2 { font-size: 40pt; line-height: .95; letter-spacing: -.04em; margin: 0 0 10mm; font-weight: 300; }
.toc h2 b { font-weight: 800; }
.toc ol { columns: 2; column-gap: 12mm; padding: 0; list-style: none; margin: 0; }
.toc li { padding: 2.4mm 0; border-bottom: .4pt solid #222; break-inside: avoid; font-size: 10pt; color: #e8e8e6; }
.toc li span { font-family: "Courier New", monospace; color: #6f6f6f; margin-right: 4mm; }
/* content */
h1.part { break-before: page; margin: 0 0 10mm; padding: 0 0 8mm; font-size: 40pt; line-height: .95; letter-spacing: -.04em; font-weight: 300; border-bottom: .5pt solid #2a2a2a; }
h1.part::before { content: "OZ STUDIO / GUIDE"; display: block; font: 7.5pt "Courier New", monospace; letter-spacing: .2em; color: #8a8a8a; margin-bottom: 14mm; }
h2.chapter { break-before: page; font-size: 26pt; line-height: 1; letter-spacing: -.03em; margin: 0 0 6mm; padding-top: 4mm; border-top: .5pt solid #3a3a3a; font-weight: 700; }
h1.part + h2.chapter { break-before: avoid; }
h3 { font-size: 13pt; margin: 8mm 0 2mm; letter-spacing: -.01em; }
p { margin: 0 0 3mm; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin: 1mm 0; }
li::marker { color: #6f6f6f; }
img { max-width: 100%; display: block; margin: 5mm auto; border: .5pt solid #2a2a2a; border-radius: 2mm; max-height: 150mm; object-fit: contain; break-inside: avoid; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; font-size: 9.2pt; break-inside: avoid; }
th { text-align: left; font-size: 6.8pt; color: #8a8a8a; border-bottom: .6pt solid #f4f4f2; padding: 2mm; }
td { border-bottom: .4pt solid #222; padding: 2.2mm 2mm; vertical-align: top; }
td img { margin: 0; max-height: 70mm; }
code { font-family: "Courier New", monospace; background: #141414; color: #f4f4f2; padding: .3mm 1.2mm; border-radius: 1mm; font-size: 9pt; }
blockquote { margin: 5mm 0; padding: 4mm 5mm; border: .5pt solid #2a2a2a; border-left: 2pt solid #f4f4f2; background: #0b0b0b; border-radius: 0 2mm 2mm 0; }
blockquote p:last-child { margin: 0; }
a { color: #f4f4f2; text-decoration-color: #555; }
/* back page */
.back { break-before: page; height: 250mm; background: #000; color: #f4f4f2; padding: 4mm 0; display: flex; flex-direction: column; justify-content: space-between; }
.back h2 { font-size: 40pt; line-height: .95; letter-spacing: -.04em; margin: 0; font-weight: 300; }
.back h2 b { display: block; font-weight: 800; }
.back img { border: 0; width: 55mm; margin: 0; filter: none; }
.back .mono { font-size: 8pt; color: #9a9a9a; }
</style></head><body>

<section class="cover">
  <div class="row mono"><span>OZ Studio / Client handover</span><span>${today}</span></div>
  <div class="tag mono">The internet, with intention.</div>
  <h1>Website &amp; newsroom<b>guide.</b></h1>
  <p class="sub">How every page and feature of the Dhaka Chronicles website and newsroom works, from A to Z, with pictures.</p>
  <img class="dc" src="${dcLogo}" alt="Dhaka Chronicles">
  <svg viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0,120 C200,60 400,190 620,140 S900,40 1000,90" fill="none" stroke="#777" stroke-width="2"/><path d="M0,150 C250,90 450,200 650,160 S880,80 1000,120" fill="none" stroke="#2a2a2a" stroke-width="22"/></svg>
  <img class="oz" src="${logo}" alt="OZ Studio">
  <div class="row bottom mono"><span>OZ Studio © ${new Date().getFullYear()}</span><span>Designed &amp; built by OZ Studios</span></div>
</section>


<section class="toc">
  <div class="kick">OZ Studio / Contents</div>
  <h2>What&rsquo;s <b>inside.</b></h2>
  <ol>${chapters.map((c) => `<li><span>${esc(c.split(".")[0])}</span>${inline(c.replace(/^[A-Z]\.\s*/, ""))}</li>`).join("")}</ol>
</section>

${toHtml(body)}

<section class="back">
  <div class="mono">OZ Studio / Thank you</div>
  <h2>Like how this<b>feels?</b></h2>
  <div>
    <p style="font-size:13pt;color:#cfcfcf;max-width:120mm">OZ Studios designed and built the Dhaka Chronicles website and newsroom. For changes, support or a new project, get in touch.</p>
    <p class="mono">zaber.tech/oz-studio · instagram.com/oz.studio._</p>
  </div>
  <img src="${logo}" alt="OZ Studio">
</section>
</body></html>`;

const htmlPath = join(root, "docs/pdf/guide.html");
writeFileSync(htmlPath, html);

const browsers = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error("Install Google Chrome or Microsoft Edge to print the PDF.");
const pdf = join(root, "docs/Dhaka-Chronicles-Guide.pdf");
execFileSync(browser, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files", `--print-to-pdf=${pdf}`, pathToFileURL(htmlPath).href], { stdio: "ignore" });
console.log("Wrote", pdf);
