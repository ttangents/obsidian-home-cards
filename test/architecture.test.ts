/**
 * Structural guarantees: the layering, the registries' asset contract,
 * and the integrity of the built stylesheet.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "./harness";
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
      assert.ok(existsSync(`assets/tiles/${id}-${mode}.webp`), `${id}-${mode}.webp`);
      assert.ok(css.includes(`--hc-bg-${id}: url("@tile:${id}-${mode}@")`), `${id} ${mode} variable`);
    }
    for (const block of css.split(/\n\}/).filter((b) => b.includes(`url("@tile:`))) {
      assert.match(block, new RegExp(`--hc-veil-${id}: \\d+%;`), `${id} veil in every mode`);
    }
    assert.ok(css.includes(`.home-cards[data-pattern="${id}"]`), `${id} selector`);
  }
});

test("custom backgrounds have a rule for each kind, on the page and on swatches", () => {
  const css = read("styles/10-backgrounds.css");
  for (const fit of ["pattern", "picture"]) {
    assert.ok(css.includes(`.home-cards[data-pattern="custom"][data-fit="${fit}"]`), `${fit} on the page`);
    assert.ok(css.includes(`.hc-swatch[data-pattern="custom"][data-fit="${fit}"]`), `${fit} on a swatch`);
  }
  // Inline properties carry the image; the stylesheet must not name one.
  assert.ok(!/custom[^{]*\{[^}]*url\(/.test(css), "no image URL in the custom rules");
});

test("every surface has a rule, or is the default", () => {
  const css = read("styles/05-surfaces.css");
  for (const { id } of SURFACES.filter((x) => x.id !== "flat")) {
    assert.ok(css.includes(`[data-surface="${id}"]`), id);
  }
});

test("the built stylesheet is current, balanced and carries its load-bearing rules", async () => {
  const { assembleCss } = await import("../scripts/build-css.mjs");
  const built = read("styles.css");
  assert.equal(built, assembleCss(), "styles.css is stale: run npm run css");
  const bare = built.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((bare.match(/{/g) ?? []).length, (bare.match(/}/g) ?? []).length);
  for (const selector of [
    ".hc-grid {", ".hc-card {", ".hc-top {", ".hc-dateline {", ".hc-seg-divider {", ".hc-picker {",
    '.home-cards[data-view="rows"] .hc-card {', ".home-cards.hc-in-bases {",
    ".setting-item.hc-picker-row {",
  ]) {
    assert.ok(built.includes(selector), selector);
  }
  assert.ok(!/^body(\.theme-dark)? \{[^}]*--hc-bg-/m.test(built), "tile variables must not sit on body");
  // Hidden cards stay hidden in every layout: the rule must follow the
  // rows layout, which gives each card a display of its own.
  const hidden = built.indexOf(".home-cards .hc-card.is-hidden { display: none; }");
  assert.ok(hidden > built.lastIndexOf('.home-cards[data-view="rows"] .hc-card {'), "hidden cards must stay hidden in rows");
  assert.ok(!/\.hc-sub\b(?!row)/.test(built), "the old .hc-sub class is retired");
});

test("the manifest passes the directory's format checks", () => {
  const m = JSON.parse(read("manifest.json")) as Record<string, unknown>;
  const allowed = new Set(["id", "name", "version", "minAppVersion", "description", "author", "authorUrl", "fundingUrl", "isDesktopOnly"]);
  for (const key of Object.keys(m)) assert.ok(allowed.has(key), key);
  const d = String(m.description);
  assert.ok(d.length >= 10 && d.length <= 250);
  assert.match(d, /^[A-Z][A-Za-z0-9\s.,!?'"-]+\.$/);
  for (const key of ["id", "name", "description"]) {
    assert.ok(!/obsidian|plugin/i.test(String(m[key])), key);
  }
  assert.match(String(m.authorUrl), /^https:\/\/github\.com\/[\w-]+$/);
  assert.equal(m.isDesktopOnly, false);
  const versions = JSON.parse(read("versions.json")) as Record<string, string>;
  assert.equal(versions[String(m.version)], m.minAppVersion);
  const pkg = JSON.parse(read("package.json")) as { version: string };
  assert.equal(pkg.version, m.version);
});

test("the license names its holder", () => {
  assert.match(read("LICENSE"), /^Copyright \(c\) \d{4} \S/m);
});

test("every tile file belongs to a registered pattern and draws sharp at 400px", async () => {
  const ids = new Set(BACKGROUNDS.map((b) => b.id));
  for (const file of readdirSync("assets/tiles")) {
    const m = /^([a-z]+)-(light|dark)\.webp$/.exec(file);
    assert.ok(m && ids.has(m[1] as never), `stray tile: ${file}`);
    // WebP VP8 header: width sits in bytes 26-27 of a lossy file.
    const buf = readFileSync(`assets/tiles/${file}`);
    assert.equal(buf.toString("ascii", 12, 16), "VP8 ", `${file}: expected lossy WebP`);
    assert.equal(buf.readUInt16LE(26) & 0x3fff, 800, `${file}: expected 800px wide`);
  }
});
