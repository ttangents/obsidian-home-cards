/**
 * Run the test suite: bundle each test/*.test.ts with esbuild, keeping
 * `obsidian` external, then hand the bundles to node's test runner.
 *
 * Keeping `obsidian` external is the point. The npm package ships types
 * only, so any runtime import of it in the tested layers fails at load.
 */

import esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outdir = mkdtempSync(join(tmpdir(), "home-cards-test-"));
try {
  const entryPoints = readdirSync("test").filter((f) => f.endsWith(".test.ts")).map((f) => join("test", f));
  await esbuild.build({
    entryPoints,
    outdir,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    outExtension: { ".js": ".mjs" },
    external: ["obsidian", "esbuild"],
    logLevel: "warning",
  });
  const bundles = readdirSync(outdir).map((f) => join(outdir, f));
  const run = spawnSync(process.execPath, ["--test", ...bundles], { stdio: "inherit" });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
