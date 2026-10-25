// Print a release's notes from src/settings/release-notes.ts as Markdown,
// for the GitHub release. Usage: node scripts/release-notes.mjs 1.34.1
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transform } from "esbuild";

const version = process.argv[2];
const source = readFileSync(new URL("../src/settings/release-notes.ts", import.meta.url), "utf8");
// The module is plain data with no imports, so it runs in an empty context.
const { code } = await transform(source, { loader: "ts", format: "cjs" });
const sandbox = { module: { exports: {} } };
sandbox.exports = sandbox.module.exports;
runInNewContext(code, sandbox);
const { RELEASE_NOTES, RELEASE_GROUPS } = sandbox.module.exports;

const note = RELEASE_NOTES.find((n) => n.version === version);
if (!note) {
  console.error(`No release notes for ${version} in src/settings/release-notes.ts.`);
  process.exit(1);
}
const out = [note.headline];
for (const group of RELEASE_GROUPS) {
  const items = note[group.key] ?? [];
  if (items.length) out.push("", `### ${group.label}`, "", ...items.map((i) => `- ${i}`));
}
if (note.worksWith) {
  const w = note.worksWith;
  out.push("", `### With ${w.plugin}`, "", `[${w.plugin}](${w.url}), ${w.about}:`, "", ...w.items.map((i) => `- ${i}`));
}
console.log(out.join("\n"));
