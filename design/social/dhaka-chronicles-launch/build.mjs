// OZ Studio Instagram carousel showcasing the Dhaka Chronicles website (6 slides, 1080×1350).
// Usage: node design/social/dhaka-chronicles-launch/build.mjs  → slide-01.png … slide-06.png in this folder.
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const img = (p) => pathToFileURL(join(root, p)).href;
const tmp = join(here, ".build");
mkdirSync(tmp, { recursive: true });

// White, transparent OZ mark from the square logo.
const markPath = join(tmp, "oz-mark.png");
{
  const g = await sharp(join(root, "design/brand/oz/oz-mark.jpg")).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = g.info;
  const px = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 255;
    px[i * 4 + 3] = g.data[i] > 40 ? g.data[i] : 0;
  }
  await sharp(px, { raw: { width, height, channels: 4 } }).trim({ threshold: 1 }).png().toFile(markPath);
}
const mark = pathToFileURL(markPath).href;

const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 1350px; background: #000; overflow: hidden; }
body { color: #f4f4f2; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; position: relative; }
.mono { font-family: "Courier New", "Courier", monospace; letter-spacing: .22em; text-transform: uppercase; }
.top, .bot { position: absolute; left: 46px; right: 46px; display: flex; justify-content: space-between; align-items: center; font-size: 19px; color: #9a9a9a; }
.top { top: 72px; padding-bottom: 46px; border-bottom: 1px solid #262626; }
.bot { bottom: 64px; padding-top: 40px; border-top: 1px solid #1c1c1c; }
.lockup { display: flex; align-items: flex-end; gap: 12px; }
.lockup img { height: 46px; }
.lockup span { font-size: 38px; letter-spacing: -.03em; line-height: .9; color: #f4f4f2; text-transform: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
.wave { position: absolute; left: 0; right: 0; bottom: 150px; width: 100%; height: 260px; }
.content { position: absolute; left: 46px; right: 46px; top: 230px; bottom: 190px; display: flex; flex-direction: column; }
.kicker { font-size: 22px; color: #a9a9a9; }
.center { justify-content: center; }
.huge-light { font-weight: 300; font-size: 128px; line-height: .9; letter-spacing: -.055em; }
.huge-bold { font-weight: 800; font-size: 128px; line-height: .9; letter-spacing: -.06em; }
.rule { border-top: 1px solid #2a2a2a; }
.lead { font-size: 40px; letter-spacing: -.02em; line-height: 1.15; }
.shot { border-radius: 18px; overflow: hidden; border: 1px solid #2a2a2a; background: #0a0a0a; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
.shot .bar { height: 38px; display: flex; align-items: center; gap: 9px; padding: 0 16px; border-bottom: 1px solid #1f1f1f; background: #0d0d0d; }
.shot .bar i { width: 11px; height: 11px; border-radius: 50%; background: #2c2c2c; display: block; }
.shot .bar b { margin-left: 14px; font: 15px "Courier New", monospace; letter-spacing: .08em; color: #777; font-weight: 400; }
.shot img { display: block; width: 100%; }
.phone { border-radius: 44px; border: 2px solid #2a2a2a; overflow: hidden; background: #000; padding: 10px; }
.phone img { display: block; width: 100%; border-radius: 34px; }
.list { list-style: none; }
.list li { display: grid; grid-template-columns: 90px 1fr; align-items: baseline; padding: 26px 0; border-top: 1px solid #222; font-size: 38px; letter-spacing: -.02em; }
.list li:last-child { border-bottom: 1px solid #222; }
.list li span { font: 20px "Courier New", monospace; letter-spacing: .2em; color: #777; }
.rings { position: absolute; right: -120px; bottom: 260px; width: 520px; height: 520px; }
`;

const wave = `<svg class="wave" viewBox="0 0 1080 260" preserveAspectRatio="none">
  <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0c0c"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
  <path d="M0,150 C220,90 420,230 650,180 S920,60 1080,110 L1080,260 L0,260 Z" fill="url(#fade)"/>
  <path d="M0,130 C230,70 430,215 660,165 S930,45 1080,95" fill="none" stroke="#7a7a7a" stroke-width="2.5"/>
  <path d="M0,175 C240,120 450,240 660,205 S940,110 1080,150" fill="none" stroke="#1d1d1d" stroke-width="2"/>
</svg>`;
const rings = `<svg class="rings" viewBox="0 0 520 520"><circle cx="260" cy="260" r="255" fill="none" stroke="#1a1a1a"/><circle cx="260" cy="260" r="200" fill="none" stroke="#1a1a1a"/></svg>`;

const lockup = `<span class="lockup"><img src="${mark}" alt=""><span>studio</span></span>`;
const frame = (n, topRight, inner, { showWave = true, showRings = false, topLeft = lockup } = {}) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
${showRings ? rings : ""}${showWave ? wave : ""}
<div class="top mono">${topLeft}<span>${topRight}</span></div>
<div class="content ${showWave ? "" : "center"}">${inner}</div>
<div class="bot mono"><span>OZ Studio © 2026</span><span>0${n} / 06 ${n < 6 ? "↗ Swipe" : ""}</span></div>
</body></html>`;

const slides = [
  // 01 — cover
  frame(
    1,
    "New work / 003",
    `<div class="kicker mono" style="margin-top:40px">Now live · dhakachronicles.com</div>
     <div style="margin-top:70px"><div class="huge-light">DHAKA</div><div class="huge-bold">CHRONICLES.</div></div>
     <div class="rule" style="margin-top:70px"></div>
     <p class="lead" style="margin-top:44px">A news website and newsroom,<br>built from scratch.</p>
     <p class="kicker mono" style="margin-top:34px">Design + development by OZ Studio.</p>`,
    { showRings: true },
  ),
  // 02 — the front page
  frame(
    2,
    "The front page",
    `<div class="kicker mono">01 — The site</div>
     <p class="lead" style="margin-top:26px;font-size:46px">Every story, front and centre.</p>
     <div class="shot" style="margin-top:46px"><div class="bar"><i></i><i></i><i></i><b>dhakachronicles.com</b></div><img src="${img("docs/guide/img/home-desktop.png")}"></div>
     <p class="kicker mono" style="margin-top:40px;font-size:19px">Lead story · featured · latest · most read</p>`,
    { showWave: false },
  ),
  // 03 — the story page
  frame(
    3,
    "The story page",
    `<div class="kicker mono">02 — Reading</div>
     <p class="lead" style="margin-top:26px;font-size:46px">Built for reading.<br>Made for sharing.</p>
     <div class="shot" style="margin-top:46px"><div class="bar"><i></i><i></i><i></i><b>/news/…</b></div><img src="${img("docs/guide/img/article.png")}"></div>
     <p class="kicker mono" style="margin-top:40px;font-size:19px">Share to WhatsApp, Facebook, X · Google-ready</p>`,
    { showWave: false },
  ),
  // 04 — phones
  frame(
    4,
    "Mobile first",
    `<div class="kicker mono">03 — On the phone</div>
     <p class="lead" style="margin-top:26px;font-size:46px">Fast where it matters.</p>
     <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:26px;margin-top:56px;align-items:start">
       <div class="phone"><img src="${img("docs/guide/img/mobile-home.jpg")}"></div>
       <div class="phone" style="margin-top:60px"><img src="${img("docs/guide/img/mobile-menu.jpg")}"></div>
       <div class="phone"><img src="${img("docs/guide/img/mobile-article.jpg")}"></div>
     </div>`,
    { showWave: false },
  ),
  // 05 — the newsroom
  frame(
    5,
    "Behind the scenes",
    `<div class="kicker mono">04 — The newsroom</div>
     <p class="lead" style="margin-top:26px;font-size:46px">Instagram to front page,<br>in one click.</p>
     <div class="shot" style="margin-top:40px"><div class="bar"><i></i><i></i><i></i><b>/admin</b></div><img src="${img("docs/guide/img/admin-overview.jpg")}"></div>
     <ul class="list" style="margin-top:36px">
       <li><span>01</span>Instagram import &amp; auto-publish</li>
       <li><span>02</span>Live readers &amp; analytics</li>
       <li><span>03</span>Brand deals, ads &amp; reports</li>
     </ul>`,
    { showWave: false },
  ),
  // 06 — CTA
  frame(
    6,
    "Web studio / 003",
    `<div class="kicker mono" style="margin-top:40px">The internet, with intention.</div>
     <div style="margin-top:80px"><div class="huge-light">LIKE HOW</div><div class="huge-bold">THIS FEELS?</div></div>
     <div class="rule" style="margin-top:70px"></div>
     <p class="lead" style="margin-top:44px">We make websites. That's what we do.</p>
     <p class="kicker mono" style="margin-top:34px">DM @oz.studio._ · zaber.tech/oz-studio</p>`,
    { showRings: true },
  ),
];

const browsers = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"];
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error("Install Google Chrome or Microsoft Edge.");
const profile = join(tmp, "profile");
slides.forEach((html, i) => {
  const n = String(i + 1).padStart(2, "0");
  const page = join(tmp, `slide-${n}.html`);
  writeFileSync(page, html);
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`, "--allow-file-access-from-files", "--force-device-scale-factor=1", "--window-size=1080,1350", "--virtual-time-budget=3000", `--screenshot=${join(here, `slide-${n}.png`)}`, pathToFileURL(page).href], { stdio: "ignore" });
  console.log("slide", n);
});

// ---------------------------------------------------------------- Instagram story (3 frames, 1080×1920)
// Key content stays between y≈260 and y≈1600 (Instagram's profile bar and reply box cover the edges).
const storyCss = css
  .replace("html, body { width: 1080px; height: 1350px;", "html, body { width: 1080px; height: 1920px;")
  .concat(`
.s-top { position: absolute; left: 60px; right: 60px; top: 250px; display: flex; justify-content: space-between; align-items: center; padding-bottom: 40px; border-bottom: 1px solid #262626; font-size: 20px; color: #9a9a9a; }
.s-bot { position: absolute; left: 60px; right: 60px; bottom: 300px; display: flex; justify-content: space-between; padding-top: 34px; border-top: 1px solid #1c1c1c; font-size: 20px; color: #9a9a9a; }
.s-body { position: absolute; left: 60px; right: 60px; top: 420px; bottom: 420px; display: flex; flex-direction: column; justify-content: center; }
.wave.s { bottom: 380px; }
.pill { display: inline-flex; align-items: center; gap: 14px; border: 1px solid #f4f4f2; border-radius: 999px; padding: 22px 34px; font-size: 22px; color: #f4f4f2; }
`);
const story = (n, topRight, inner, { showWave = false, showRings = false } = {}) => `<!doctype html><html><head><meta charset="utf-8"><style>${storyCss}</style></head><body>
${showRings ? rings.replace('class="rings"', 'class="rings" style="bottom:620px"') : ""}${showWave ? wave.replace('class="wave"', 'class="wave s"') : ""}
<div class="s-top mono">${lockup}<span>${topRight}</span></div>
<div class="s-body">${inner}</div>
<div class="s-bot mono"><span>OZ Studio © 2026</span><span>0${n} / 03</span></div>
</body></html>`;

const stories = [
  story(
    1,
    "New work / 003",
    `<div class="kicker mono">Now live</div>
     <div style="margin-top:60px"><div class="huge-light" style="font-size:150px">DHAKA</div><div class="huge-bold" style="font-size:138px">CHRONICLES.</div></div>
     <div class="rule" style="margin-top:60px"></div>
     <p class="lead" style="margin-top:44px;font-size:46px">A news website and newsroom,<br>built from scratch.</p>
     <p class="kicker mono" style="margin-top:34px">Design + development by OZ Studio.</p>`,
    { showWave: true, showRings: true },
  ),
  story(
    2,
    "Mobile first",
    `<div class="kicker mono">The site</div>
     <p class="lead" style="margin-top:22px;font-size:52px">Every story,<br>front and centre.</p>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:48px auto 0;width:820px;align-items:start">
       <div class="phone"><img src="${img("docs/guide/img/mobile-home.jpg")}" style="height:640px;object-fit:cover;object-position:top"></div>
       <div class="phone" style="margin-top:70px"><img src="${img("docs/guide/img/mobile-article.jpg")}" style="height:640px;object-fit:cover;object-position:top"></div>
     </div>`,
  ),
  story(
    3,
    "Web studio / 003",
    `<div class="kicker mono">The internet, with intention.</div>
     <div style="margin-top:70px;white-space:nowrap"><div class="huge-light" style="font-size:132px">LIKE HOW</div><div class="huge-bold" style="font-size:132px">THIS FEELS?</div></div>
     <div class="rule" style="margin-top:60px"></div>
     <p class="lead" style="margin-top:44px;font-size:46px">We make websites.<br>That's what we do.</p>
     <div style="margin-top:56px"><span class="pill mono">DM @oz.studio._ ↗</span></div>`,
    { showRings: true },
  ),
];
stories.forEach((html, i) => {
  const n = String(i + 1).padStart(2, "0");
  const page = join(tmp, `story-${n}.html`);
  writeFileSync(page, html);
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`, "--allow-file-access-from-files", "--force-device-scale-factor=1", "--window-size=1080,1920", "--virtual-time-budget=3000", `--screenshot=${join(here, `story-${n}.png`)}`, pathToFileURL(page).href], { stdio: "ignore" });
  console.log("story", n);
});

// ---------------------------------------------------------------- single story frame (everything in one)
{
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${storyCss}
.single { position: absolute; left: 60px; right: 60px; top: 380px; bottom: 380px; display: flex; flex-direction: column; }
</style></head><body>
${rings.replace('class="rings"', 'class="rings" style="bottom:900px"')}
<div class="s-top mono">${lockup}<span>New work / 003</span></div>
<div class="single">
  <div class="kicker mono">Now live · dhakachronicles.com</div>
  <div style="margin-top:34px;white-space:nowrap"><div class="huge-light" style="font-size:112px">DHAKA</div><div class="huge-bold" style="font-size:112px">CHRONICLES.</div></div>
  <div style="display:flex;gap:40px;align-items:flex-end;margin-top:46px">
    <div class="phone" style="width:430px;flex:none"><img src="${img("docs/guide/img/mobile-home.jpg")}" style="height:560px;object-fit:cover;object-position:top"></div>
    <div style="display:flex;flex-direction:column;gap:26px;padding-bottom:10px">
      <p class="lead" style="font-size:40px">A news website and newsroom, built from scratch.</p>
      <p class="kicker mono" style="font-size:19px;line-height:1.7">Design +<br>development<br>by OZ Studio.</p>
    </div>
  </div>
  <div class="rule" style="margin-top:46px"></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:36px">
    <p class="lead" style="font-size:34px">Like how this feels?</p>
    <span class="pill mono" style="font-size:20px;padding:18px 28px">DM @oz.studio._ ↗</span>
  </div>
</div>
<div class="s-bot mono"><span>OZ Studio © 2026</span><span>The internet, with intention.</span></div>
</body></html>`;
  const page = join(tmp, "story-single.html");
  writeFileSync(page, html);
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`, "--allow-file-access-from-files", "--force-device-scale-factor=1", "--window-size=1080,1920", "--virtual-time-budget=3000", `--screenshot=${join(here, "story-single.png")}`, pathToFileURL(page).href], { stdio: "ignore" });
  console.log("story single");
}

// ---------------------------------------------------------------- case-study story (matches the Corso Velle story layout)
{
  const W = 1080, H = 1920;
  const caseCss = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${W}px; height: ${H}px; background: #000; overflow: hidden; }
body { color: #f4f4f2; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; position: relative; }
.m { font-family: Consolas, "Courier New", monospace; letter-spacing: .2em; text-transform: uppercase; }
.top { position: absolute; left: 44px; right: 44px; top: 140px; height: 90px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; padding-bottom: 36px; }
.top .m { font-size: 24px; color: #bdbdbd; }
.lockup { display: flex; align-items: flex-end; gap: 12px; }
.lockup img { height: 48px; }
.lockup span { font-size: 40px; letter-spacing: -.035em; line-height: .9; }
.kick { position: absolute; left: 44px; top: 302px; font-size: 24px; color: #a9a9a9; }
.title { position: absolute; left: 40px; top: 360px; line-height: .88; letter-spacing: -.055em; }
.title .l { font-weight: 300; font-size: 132px; }
.title .b { font-weight: 800; font-size: 132px; letter-spacing: -.06em; }
.browser { position: absolute; left: 44px; top: 790px; width: 884px; border-radius: 16px; overflow: hidden; background: #111; border: 1px solid #2a2a2a; }
.browser .bar { height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 18px; background: #161616; }
.browser .bar i { width: 11px; height: 11px; border-radius: 50%; background: #3a3a3a; }
.browser .bar b { flex: 1; margin-left: 40px; height: 24px; border-radius: 6px; background: #222; font: 14px Consolas, monospace; letter-spacing: .12em; color: #8a8a8a; display: grid; place-items: center; font-weight: 400; }
.browser img { display: block; width: 100%; height: 520px; object-fit: cover; object-position: top; }
.browser .foot { height: 40px; background: #111; }
.phone { position: absolute; left: 720px; top: 925px; width: 330px; transform: rotate(4deg); border-radius: 46px; background: #111; padding: 12px; border: 2px solid #2c2c2c; box-shadow: 0 40px 90px rgba(0,0,0,.75); z-index: 3; }
.phone img { display: block; width: 100%; height: 640px; object-fit: cover; object-position: top; border-radius: 36px; }
.wave { position: absolute; left: 0; top: 1300px; width: ${W}px; height: 420px; z-index: 2; }
.tap { position: absolute; left: 44px; top: 1446px; font-size: 26px; color: #f4f4f2; z-index: 4; }
.sticker { position: absolute; left: 44px; top: 1510px; width: 500px; height: 118px; border: 2px dashed #3a3a3a; border-radius: 22px; display: grid; place-items: center; font-size: 20px; color: #4a4a4a; z-index: 4; background: rgba(0,0,0,.55); }
.bot { position: absolute; left: 44px; right: 44px; top: 1700px; display: flex; justify-content: space-between; border-top: 1px solid #222; padding-top: 40px; font-size: 24px; color: #bdbdbd; }
`;
  const caseWave = `<svg class="wave" viewBox="0 0 1080 420" preserveAspectRatio="none">
  <defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101010"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
  <path d="M0,170 C180,90 330,120 520,210 S860,330 1080,150 L1080,420 L0,420 Z" fill="url(#cf)"/>
  <path d="M0,170 C180,90 330,120 520,210 S860,330 1080,150" fill="none" stroke="#e8e8e6" stroke-width="3"/>
  <path d="M0,240 C200,170 360,200 540,280 S880,380 1080,230" fill="none" stroke="#555" stroke-width="2"/>
</svg>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${caseCss}</style></head><body>
<div class="top"><span class="lockup"><img src="${mark}" alt=""><span>studio</span></span><span class="m">New work / 002</span></div>
<div class="kick m">Case study — News website</div>
<div class="title"><div class="l">WE MADE</div><div class="b">DHAKA</div><div class="b">CHRONICLES.</div></div>
<div class="browser"><div class="bar"><i></i><i></i><i></i><b>dhakachronicles.com</b></div><img src="${img("docs/guide/img/home-desktop.png")}"><div class="foot"></div></div>
<div class="phone"><img src="${img("docs/guide/img/mobile-article.jpg")}"></div>
${caseWave}
<div class="tap m">Tap the link ↓</div>
<div class="sticker m">Link sticker here</div>
<div class="bot m"><span>OZ Studio © 2026</span><span>@oz.studio._</span></div>
</body></html>`;
  const page = join(tmp, "story-case.html");
  writeFileSync(page, html);
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`, "--allow-file-access-from-files", "--force-device-scale-factor=1", `--window-size=${W},${H}`, "--virtual-time-budget=3000", `--screenshot=${join(here, "story-case.png")}`, pathToFileURL(page).href], { stdio: "ignore" });
  console.log("story case");
}
