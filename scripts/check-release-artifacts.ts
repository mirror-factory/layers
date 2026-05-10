#!/usr/bin/env tsx
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const cwd = process.cwd();
const evidenceDir = join(cwd, ".evidence");
const required = process.env.RELEASE_ARTIFACTS_REQUIRED === "1";
const roots = process.env.RELEASE_ARTIFACT_ROOTS?.split(",").map(value => value.trim()).filter(Boolean) ?? [
  "dist-electron",
  "release-assets",
  "android/app/build/outputs",
  "ios/App/build",
];

function listFiles(root: string): Array<{ path: string; bytes: number; modifiedAt: string }> {
  const fullRoot = root.startsWith("/") ? root : join(cwd, root);
  const files: Array<{ path: string; bytes: number; modifiedAt: string }> = [];
  if (!existsSync(fullRoot)) return files;

  function walk(current: string) {
    const stat = statSync(current);
    if (stat.isFile()) {
      files.push({
        path: current.startsWith(cwd) ? relative(cwd, current) : current,
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
      return;
    }
    if (!stat.isDirectory()) return;
    for (const entry of readdirSync(current)) walk(join(current, entry));
  }

  walk(fullRoot);
  return files;
}

const artifacts = roots.flatMap(listFiles)
  .filter(file => /\.(apk|aab|ipa|dmg|exe|msi|zip)$/i.test(file.path))
  .sort((a, b) => a.path.localeCompare(b.path))
  .slice(0, 500);

mkdirSync(evidenceDir, { recursive: true });
const out = join(evidenceDir, "release-artifacts.json");
writeFileSync(out, JSON.stringify({
  runAt: new Date().toISOString(),
  pass: artifacts.length > 0 || !required,
  required,
  roots,
  artifactCount: artifacts.length,
  artifacts,
}, null, 2) + "\n");
console.log(`[release-artifacts] wrote ${out}`);

if (artifacts.length === 0 && required) {
  console.error("[release-artifacts] no release/native artifacts found.");
  process.exit(1);
}
