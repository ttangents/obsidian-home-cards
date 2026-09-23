/**
 * Bundle src/main.ts to main.js, the file Obsidian loads.
 *
 * Unminified on purpose: the installed plugin stays readable, which is
 * how Obsidian's community reviewers and curious users read plugins.
 * `node esbuild.config.mjs watch` rebuilds on save.
 */

import esbuild from "esbuild";
import { builtinModules } from "node:module";

const banner = `/*
 * Home Cards: a configurable start page for Obsidian.
 * Bundled by esbuild; the source is in src/.
 */`;

const options = {
  entryPoints: ["src/main.ts"],
  outfile: "main.js",
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2021",
  banner: { js: banner },
  external: [
    "obsidian",
    "electron",
    "@codemirror/*",
    "@lezer/*",
    ...builtinModules,
  ],
  logLevel: "info",
  sourcemap: false,
  treeShaking: true,
  minify: false,
};

if (process.argv[2] === "watch") {
  const ctx = await esbuild.context({ ...options, sourcemap: "inline" });
  await ctx.watch();
} else {
  await esbuild.build(options);
}
