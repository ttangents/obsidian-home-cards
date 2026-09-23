/**
 * Structural guarantees: the layering, the registries' asset contract,
 * and the integrity of the built stylesheet.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { BACKGROUNDS, SECTION_KINDS, SURFACES, VIEW_MODES } from "../src/settings/schema";

const read = (p: string) => readFileSync(p, "utf8");
const sources = (dir: string) =>
  readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => ({ file: join(dir, f), text: read(join(dir, f)) }));

test("settings/ and compose/ import obsidian for types only", () => {
  for (const { file, text } of [...sources("src/settings"), ...sources("src/compose")]) {
    for (const line of text.split("\n")) {
      if (/from "obsidian"/.test(line)) assert.match(line, /^import type /, `${file}: ${line}`);
    }
  }
});

test("each layer imports only from the layers above it", () => {
  const order = ["settings", "compose", "render", "settings-tab"];
  for (const [rank, layer] of order.entries()) {
    for (const { file, text } of sources(join("src", layer))) {
      for (const m of text.matchAll(/^import (type )?.*from "\.\.\/([\w-]+)/gm)) {
        const target = m[2];
        if (target === "main") {
          assert.ok(m[1], `${file}: only a type import of main is allowed`);
          continue;
        }
        assert.ok(order.indexOf(target) <= rank, `${file} imports from ${target}`);
      }
    }
  }
});

test("registries have unique ids", () => {
  for (const registry of [SECTION_KINDS, VIEW_MODES, SURFACES, BACKGROUNDS]) {
    const ids = registry.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test("every pattern has both tiles, a variable pair and a selector", () => {
  const css = read("styles/10-backgrounds.css");
  for (const { id } of BACKGROUNDS.filter((b) => b.id !== "plain")) {
    for (const mode of ["light", "dark"]) {
      assert.ok(existsSync(`assets/tiles/${id}-${mode}.png`), `${id}-${mode}.png`);
      assert.ok(css.includes(`--hc-bg-${id}: url("@tile:${id}-${mode}@")`), `${id} ${mode} variable`);
    }
    assert.ok(css.includes(`.home-cards[data-pattern="${id}"]`), `${id} selector`);
  }
});

test("every surface has a rule, or is the default", () => {
  const css = read("styles/05-surfaces.css");
  for (const { id } of SURFACES.filter((x) => x.id !== "flat")) {
    assert.ok(css.includes(`[data-surface="${id}"]`), id);
  }
});

test("the built stylesheet is current, balanced and carries its load-bearing rules", async () => {
  const { assembleCss } = await import(join(process.cwd(), "scripts/build-css.mjs"));
  const built = read("styles.css");
  assert.equal(built, assembleCss(), "styles.css is stale: run npm run css");
  const bare = built.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((bare.match(/{/g) ?? []).length, (bare.match(/}/g) ?? []).length);
  for (const selector of [
    ".hc-grid {", ".hc-card {", ".hc-top {", ".hc-dateline {", ".hc-seg .hc-reload {",
    '.home-cards[data-view="rows"] .hc-card {', ".home-cards.hc-in-bases {",
    ".home-cards-settings .setting-item.hc-subrow {",
  ]) {
    assert.ok(built.includes(selector), selector);
  }
  assert.ok(!/^body(\.theme-dark)? \{[^}]*--hc-bg-/m.test(built), "tile variables must not sit on body");
  assert.ok(!/\.hc-sub\b(?!row)/.test(built), "the old .hc-sub class is retired");
});
