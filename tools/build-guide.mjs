/* Renders the handwritten sheets in tools/ to PNGs in assets/: the annotated quick-guide sheet on the
   home page, and one sheet per tab of the Settings dialog.

       node tools/build-guide.mjs                  every sheet
       node tools/build-guide.mjs copilot general  only those

   Like tools/build-images.py, this is run by hand when a sheet or a screenshot changes, not by the
   Pages workflow: the outputs are committed binaries, and rewriting them on every push would put a
   diff in every push.

   It drives a headless Chromium over its command line rather than through Playwright, so it needs
   nothing installed - any Chrome, Edge or Playwright Chromium already on the machine will do. A sheet
   is laid out at CSS pixels and shot at --force-device-scale-factor=2, so the handwriting and the
   arrows are drawn at 2x while the screenshot inside is doubled by whole pixels.

   After running this, run tools/build-images.py to rebuild the .webps the page actually serves. */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/* width/height must match the `sheet` block in each source file's drawSheet() config. The two are
   checked against each other by the render below, because a mismatch is otherwise invisible until
   the sheet is on the page with the wrong aspect ratio.

   The guide sheet is 1760 wide because it is built round a 1066px screenshot with a column of
   handwriting either side. The settings sheets are 1220, which renders 2440 - shown inside the
   page's 1120px content column that is 0.92x the design pixels, so they are legible in place rather
   than only when opened full size. */
const SHEETS = [
  { name: "guide",     source: "guide.html",              target: "SwMacroFlow_Handwritten_Guide.png",      width: 1760, height: 1240 },
  { name: "general",   source: "settings-general.html",   target: "SwMacroFlow_Setting_General_Guide.png",  width: 1220, height: 1050 },
  { name: "copilot",   source: "settings-copilot.html",   target: "SwMacroFlow_Setting_Copilot_Guide.png",  width: 1220, height: 1090 },
  { name: "scheduled", source: "settings-scheduled.html", target: "SwMacroFlow_Setting_Scheduled_Guide.png", width: 1220, height: 985 },
];

const SCALE = 2;

/* Playwright keeps its browsers in a versioned folder, so the version is found rather than named.

   The headless shell is looked for across every entry before the full browser is looked for in any
   of them, rather than taking whatever a folder listing happens to hand over first. Both are called
   chromium-something, and "chromium-1234" sorts ahead of "chromium_headless_shell-1234", so ordering
   by directory picks the full browser - which sits there and never returns from --screenshot. */
function playwrightChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH
    || join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (!base || !existsSync(base)) return [];

  const builds = [
    ["chromium_headless_shell-", "chrome-headless-shell-win64", "chrome-headless-shell.exe"],
    ["chromium_headless_shell-", "chrome-headless-shell-linux", "chrome-headless-shell"],
    ["chromium-", "chrome-win64", "chrome.exe"],
    ["chromium-", "chrome-linux", "chrome"],
  ];
  const entries = readdirSync(base);
  const found = [];
  for (const [prefix, folder, exe] of builds) {
    for (const entry of entries) {
      if (entry.startsWith(prefix)) found.push(join(base, entry, folder, exe));
    }
  }
  return found;
}

function findBrowser() {
  const candidates = [
    process.env.GUIDE_CHROME,
    ...playwrightChromium(),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    "No Chrome, Edge or Playwright Chromium found. Point GUIDE_CHROME at a browser executable."
  );
}

/* PNG carries its dimensions in the IHDR chunk, at a fixed offset. Cheaper than a dependency. */
function pngSize(path) {
  const header = readFileSync(path).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

function render(browser, sheet) {
  const source = join(ROOT, "tools", sheet.source);
  const target = join(ROOT, "assets", sheet.target);

  // Chromium writes a profile wherever it is told to; a throwaway one keeps the render from picking
  // up whatever is in the real one - a zoom level or a forced colour scheme would both land on the
  // sheet.
  const profile = mkdtempSync(join(tmpdir(), "swmacroflow-guide-"));

  try {
    execFileSync(browser, [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--force-device-scale-factor=" + SCALE,
      `--window-size=${sheet.width},${sheet.height}`,
      // The page loads the screenshot and the Caveat woff2 from assets/ over file://, which Chromium
      // treats as cross-origin without this.
      "--allow-file-access-from-files",
      // Lets any font and image work finish before the shot, without polling for it.
      "--virtual-time-budget=8000",
      `--user-data-dir=${profile}`,
      `--screenshot=${target}`,
      pathToFileURL(source).href,
      // Bounded, because a browser that decides not to exit would otherwise hang the build with no
      // output at all - which is exactly what a full chrome.exe does here in place of the shell.
    ], { stdio: ["ignore", "ignore", "inherit"], timeout: 90_000 });
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }

  if (!existsSync(target)) {
    throw new Error(`Chromium exited without writing a screenshot for ${sheet.name}.`);
  }

  const size = pngSize(target);
  const expected = { width: sheet.width * SCALE, height: sheet.height * SCALE };
  if (size.width !== expected.width || size.height !== expected.height) {
    throw new Error(
      `${sheet.name}: rendered ${size.width}x${size.height}, expected ${expected.width}x${expected.height}. `
      + `The size here and the sheet block in tools/${sheet.source} have to agree, and index.html `
      + "carries the same numbers on the img tag."
    );
  }

  const kb = Math.round(statSync(target).size / 1024);
  console.log(`  ${target.slice(ROOT.length + 1)}  ${kb} KB  ${size.width}x${size.height}`);
}

const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !SHEETS.some((sheet) => sheet.name === name));
if (unknown.length) {
  throw new Error(
    `No sheet called ${unknown.join(", ")}. Known sheets: ${SHEETS.map((s) => s.name).join(", ")}.`
  );
}
const building = wanted.length ? SHEETS.filter((sheet) => wanted.includes(sheet.name)) : SHEETS;

const browser = findBrowser();
console.log(`Building ${building.length} sheet${building.length === 1 ? "" : "s"}`);
console.log(`  browser  ${browser}`);

for (const sheet of building) render(browser, sheet);

console.log("Now run: python tools/build-images.py");
