/* Renders tools/guide.html to assets/SwMacroFlow_Handwritten_Guide.png, the annotated quick-guide
   sheet on the home page.

       node tools/build-guide.mjs

   Like tools/build-images.py, this is run by hand when the sheet or the screenshot changes, not by
   the Pages workflow: the output is a committed binary, and rewriting it on every push would put a
   diff in every push.

   It drives a headless Chromium over its command line rather than through Playwright, so it needs
   nothing installed - any Chrome, Edge or Playwright Chromium already on the machine will do. The
   sheet is laid out at CSS pixels and shot at --force-device-scale-factor=2, so the handwriting and
   the arrows are drawn at 2x while the screenshot inside is doubled by whole pixels.

   After running this, run tools/build-images.py to rebuild the .webp the page actually serves. */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "tools", "guide.html");
const TARGET = join(ROOT, "assets", "SwMacroFlow_Handwritten_Guide.png");

// Must match SHEET in tools/guide-draw.js. Checked against the render below, because a mismatch here
// is otherwise invisible until the sheet is on the page with the wrong aspect ratio.
const SHEET = { width: 1760, height: 1240 };
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

const browser = findBrowser();
console.log("Building the quick-guide sheet");
console.log(`  browser  ${browser}`);

// Chromium writes a profile wherever it is told to; a throwaway one keeps the render from picking up
// whatever is in the real one - a zoom level or a forced colour scheme would both land on the sheet.
const profile = mkdtempSync(join(tmpdir(), "swmacroflow-guide-"));

try {
  execFileSync(browser, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "--force-device-scale-factor=" + SCALE,
    `--window-size=${SHEET.width},${SHEET.height}`,
    // The page loads the screenshot and the Caveat woff2 from assets/ over file://, which Chromium
    // treats as cross-origin without this.
    "--allow-file-access-from-files",
    // Lets any font and image work finish before the shot, without polling for it.
    "--virtual-time-budget=8000",
    `--user-data-dir=${profile}`,
    `--screenshot=${TARGET}`,
    pathToFileURL(SOURCE).href,
    // Bounded, because a browser that decides not to exit would otherwise hang the build with no
    // output at all - which is exactly what a full chrome.exe does here in place of the shell.
  ], { stdio: ["ignore", "ignore", "inherit"], timeout: 90_000 });
} finally {
  rmSync(profile, { recursive: true, force: true });
}

if (!existsSync(TARGET)) throw new Error("Chromium exited without writing a screenshot.");

const size = pngSize(TARGET);
const expected = { width: SHEET.width * SCALE, height: SHEET.height * SCALE };
if (size.width !== expected.width || size.height !== expected.height) {
  throw new Error(
    `Rendered ${size.width}x${size.height}, expected ${expected.width}x${expected.height}. `
    + "SHEET here and in tools/guide-draw.js have to agree, and index.html carries the same numbers "
    + "on the img tag."
  );
}

const kb = Math.round(statSync(TARGET).size / 1024);
console.log(`  ${TARGET.slice(ROOT.length + 1)}  ${kb} KB  ${size.width}x${size.height}`);
console.log("Now run: python tools/build-images.py");
