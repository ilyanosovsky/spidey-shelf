#!/usr/bin/env node
import { createRequire } from "node:module";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Puts the barcode reader's WebAssembly binary in `public/` so the scanner never touches a CDN.
 *
 * zxing-wasm bakes a jsDelivr URL into its build and fetches the `.wasm` from there on the
 * first decode. That is a third-party request made by a phone standing in a shop: one more
 * thing that can be down, one more party that learns the owner is scanning something, and
 * one more thing to fail on a network that blocks the CDN. `src/lib/barcode/decode.ts`
 * overrides `locateFile` to point at `/barcode/zxing_reader.wasm` instead — this script is
 * what makes that path exist.
 *
 * Wired to BOTH `postinstall` and `prebuild`: the first covers `npm ci` on Vercel and in
 * CI, the second covers a build in a tree where the copy was cleaned away. The file itself
 * is git-ignored — it is a build artifact of a pinned dependency, not source, and the
 * version that ships is always the one in `node_modules`.
 */

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "public", "barcode", "zxing_reader.wasm");

function resolveWasm() {
  // The package's exports map names the asset; the literal path is the fallback for a
  // resolver that refuses to hand back a non-JS export.
  try {
    return require.resolve("zxing-wasm/reader/zxing_reader.wasm");
  } catch {
    return path.join(root, "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
  }
}

async function main() {
  const source = resolveWasm();

  let bytes;
  try {
    bytes = (await stat(source)).size;
  } catch {
    // A postinstall that dies takes the whole `npm ci` with it, and the only thing broken
    // is the scanner. Say so loudly and let the rest of the app install.
    console.warn(`[zxing] ${source} not found — the scanner will have no wasm to load.`);
    return;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`[zxing] ${path.relative(root, destination)} (${Math.round(bytes / 1024)} KB)`);
}

await main();
