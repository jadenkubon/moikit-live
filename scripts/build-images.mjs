/**
 * Two-tier product imagery pipeline.
 *
 *   node scripts/build-images.mjs [--refetch]
 *
 * Downloads each product photo at source resolution (cached in .image-cache/),
 * then emits two content-hashed WebP variants into public/img/items:
 *
 *   thumb — 160px. Loads for every visitor, so it's kept minimal. Covers the
 *           52px builder tile and the 38px related-kit tile at 3x DPR.
 *   full  — 1200px, quality stepped down until it fits FULL_BUDGET. Only
 *           fetched when someone opens the lightbox, so it can be generous —
 *           but the budget stops texture-heavy shots (towels, fabric) from
 *           ballooning past 300kb while flat packshots stay at high quality.
 *
 * Filenames carry a content hash so the deploy can serve them immutable for a
 * year; changing a photo changes its filename, so nothing goes stale.
 * The generated map lands in src/data/itemImages.ts — do not hand-edit it.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".image-cache");
const OUT = path.join(ROOT, "public/img/items");
const GENERATED = path.join(ROOT, "src/data/itemImages.ts");

const THUMB_PX = 160;
const FULL_PX = 1200;
const FULL_BUDGET = 150 * 1024;

/**
 * Tried in order; first variant under budget wins. Width is given up before
 * quality: a fabric close-up at 800px/q82 reads far better than the same shot
 * at 1200px/q52, and lands smaller. Flat packshots never get past the first
 * rung, so they stay at full size and quality.
 */
const FULL_LADDER = [
  [1200, 82], [1200, 76], [1200, 70],
  [1040, 80], [1040, 74],
  [900, 80], [900, 72],
  [800, 82], [800, 72],
  [700, 74],
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const refetch = process.argv.includes("--refetch");
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/sources.json"), "utf8"));

const fetchBuf = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fi-FI,fi;q=0.9" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

/** IKEA renders og:image server-side, so a plain request is enough. */
async function ikeaImageUrl(pageUrl) {
  const res = await fetch(pageUrl, { headers: { "User-Agent": UA } });
  const html = await res.text();
  const m = html.match(/property="og:image"\s+content="([^"]+)"/) ||
            html.match(/content="([^"]+)"\s+property="og:image"/);
  if (!m) throw new Error("no og:image");
  return m[1];
}

/**
 * tavaratalomainio.fi is a client-rendered SPA — the initial HTML carries no
 * product image at all, so these need a real browser. Playwright is resolved
 * from the global install to keep it out of this project's dependencies.
 */
async function withBrowser(fn) {
  const { execSync } = await import("node:child_process");
  const globalRoot = execSync("npm root -g").toString().trim();
  const { chromium } = require(path.join(globalRoot, "playwright"));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ userAgent: UA, locale: "fi-FI" });
    return await fn(await ctx.newPage());
  } finally {
    await browser.close();
  }
}

const cachePath = (id) => path.join(CACHE, id + ".bin");

async function ensureCached(id, getUrl, page) {
  if (!refetch && fs.existsSync(cachePath(id))) return fs.readFileSync(cachePath(id));
  const url = await getUrl(page);
  const buf = await fetchBuf(url);
  if (buf.length < 2000) throw new Error(`suspiciously small (${buf.length}b)`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cachePath(id), buf);
  return buf;
}

/** Walk the ladder and take the first variant that fits the byte budget. */
async function encodeToBudget(buf, budget) {
  let last;
  for (const [width, quality] of FULL_LADDER) {
    const data = await sharp(buf).resize(width, width, { fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
    last = { data, quality, width };
    if (data.length <= budget) return last;
  }
  return last;
}

const hash = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const raw = new Map();
  const fail = [];

  for (const [id, url] of Object.entries(sources.ikea)) {
    try {
      raw.set(id, await ensureCached(id, () => ikeaImageUrl(url)));
      process.stdout.write(".");
    } catch (e) { fail.push(`${id}: ${e.message}`); process.stdout.write("!"); }
  }
  for (const [id, url] of Object.entries(sources.directImage)) {
    if (id.startsWith("_")) continue;
    try {
      raw.set(id, await ensureCached(id, () => url));
      process.stdout.write(".");
    } catch (e) { fail.push(`${id}: ${e.message}`); process.stdout.write("!"); }
  }
  console.log(` ${raw.size} via http`);

  const ttPending = Object.entries(sources.tavaratalo).filter(([id]) => refetch || !fs.existsSync(cachePath(id)));
  if (ttPending.length) {
    await withBrowser(async (page) => {
      for (const [id, url] of Object.entries(sources.tavaratalo)) {
        try {
          raw.set(id, await ensureCached(id, async () => {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
            await page.waitForSelector('meta[property="og:image"]', { state: "attached", timeout: 25000 });
            const src = await page.evaluate(() => {
              const big = [...document.querySelectorAll("img")].map((i) => i.src).find((s) => s.includes("tuotesivu_"));
              return big || document.querySelector('meta[property="og:image"]')?.content || null;
            });
            if (!src) throw new Error("no image");
            if (src.includes("category_images")) throw new Error("delisted — page falls back to a category placeholder");
            return src;
          }, page));
          process.stdout.write(".");
        } catch (e) { fail.push(`${id}: ${e.message}`); process.stdout.write("!"); }
      }
    });
  } else {
    for (const [id] of Object.entries(sources.tavaratalo)) raw.set(id, fs.readFileSync(cachePath(id)));
  }
  console.log(` ${raw.size} cached total`);

  const map = {};
  let thumbBytes = 0, fullBytes = 0, degraded = [];

  for (const [id, buf] of [...raw].sort(([a], [b]) => a.localeCompare(b))) {
    const thumb = await sharp(buf).resize(THUMB_PX, THUMB_PX, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const full = await encodeToBudget(buf, FULL_BUDGET);
    const meta = await sharp(full.data).metadata();

    const tName = `${id}.${hash(thumb)}.webp`;
    const fName = `${id}.${hash(full.data)}.full.webp`;
    fs.writeFileSync(path.join(OUT, tName), thumb);
    fs.writeFileSync(path.join(OUT, fName), full.data);

    map[id] = { thumb: `/img/items/${tName}`, full: `/img/items/${fName}`, w: meta.width, h: meta.height };
    thumbBytes += thumb.length;
    fullBytes += full.data.length;
    if (full.width < FULL_PX || full.quality < 82) {
      degraded.push(`${id} ${full.width}px q${full.quality} ${(full.data.length / 1024).toFixed(0)}kb`);
    }
  }

  const entries = Object.entries(map)
    .map(([id, v]) => `  "${id}": { thumb: "${v.thumb}", full: "${v.full}", w: ${v.w}, h: ${v.h} },`)
    .join("\n");

  fs.writeFileSync(
    GENERATED,
    `// GENERATED by scripts/build-images.mjs — do not edit by hand.\n` +
      `// Filenames are content-hashed, so /img/items/* can be served immutable.\n\n` +
      `export interface ItemImage {\n  /** ${THUMB_PX}px tile shown in listings. */\n  thumb: string;\n` +
      `  /** Up to ${FULL_PX}px, fetched only when the lightbox opens. */\n  full: string;\n  w: number;\n  h: number;\n}\n\n` +
      `export const ITEM_IMAGES: Record<string, ItemImage> = {\n${entries}\n};\n`
  );

  console.log(`\n${Object.keys(map).length} items -> ${OUT}`);
  console.log(`thumbs ${(thumbBytes / 1024).toFixed(0)}kb total (avg ${(thumbBytes / Object.keys(map).length / 1024).toFixed(1)}kb)`);
  console.log(`full   ${(fullBytes / 1024 / 1024).toFixed(2)}mb total (avg ${(fullBytes / Object.keys(map).length / 1024).toFixed(0)}kb, on-demand only)`);
  if (degraded.length) console.log(`\nquality stepped down to fit budget:\n  ${degraded.join("\n  ")}`);
  if (fail.length) { console.log(`\nFAILED:\n  ${fail.join("\n  ")}`); process.exitCode = 1; }
}

main();
