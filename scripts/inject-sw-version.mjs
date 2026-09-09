// Runs after `next build`. Stamps the real Next.js build ID into public/sw.js's
// CACHE constant so every deploy gets a genuinely unique cache name automatically
// — no more relying on a developer remembering to hand-bump a version string.
// The existing `activate` handler in sw.js already deletes any cache key that
// doesn't match the current CACHE name, so this alone makes stale-cache
// cleanup fully automatic across deploys.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const buildIdPath = join(process.cwd(), ".next", "BUILD_ID");
if (!existsSync(buildIdPath)) {
  console.warn("[inject-sw-version] .next/BUILD_ID not found — skipping (is this a `next build`?)");
  process.exit(0);
}

const buildId = readFileSync(buildIdPath, "utf8").trim();
const swPath = join(process.cwd(), "public", "sw.js");
const sw = readFileSync(swPath, "utf8");

const updated = sw.replace(/const CACHE = "[^"]*";/, `const CACHE = "musalleen-${buildId}";`);
if (updated === sw) {
  console.error("[inject-sw-version] Could not find `const CACHE = \"...\";` in public/sw.js — nothing replaced.");
  process.exit(1);
}

writeFileSync(swPath, updated);
console.log(`[inject-sw-version] public/sw.js CACHE set to musalleen-${buildId}`);
