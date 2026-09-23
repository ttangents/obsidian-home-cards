import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSettings } from "../src/settings/normalize";
import { defaultSettings, LIMITS } from "../src/settings/schema";

test("garbage in yields defaults", () => {
  for (const junk of [null, undefined, 42, "x", [], [1, 2]]) {
    assert.deepEqual(normalizeSettings(junk), defaultSettings());
  }
});

test("wrongly typed values fall back field by field", () => {
  const s = normalizeSettings({ greetingName: 7, showTags: "yes", cardSurface: "velvet", background: 3 });
  const d = defaultSettings();
  assert.equal(s.greetingName, d.greetingName);
  assert.equal(s.showTags, d.showTags);
  assert.equal(s.cardSurface, d.cardSurface);
  assert.equal(s.background, d.background);
});

test("numbers clamp to their limits and accept numeric strings", () => {
  const s = normalizeSettings({ cardMinWidth: 9999, maxTags: -3, dekLines: "5", sections: [{ id: "a", count: 99 }] });
  assert.equal(s.cardMinWidth, LIMITS.cardMinWidth.max);
  assert.equal(s.maxTags, LIMITS.maxTags.min);
  assert.equal(s.dekLines, 5);
  assert.equal(s.sections[0].count, LIMITS.count.max);
});

test("unknown and retired keys are dropped", () => {
  const s = normalizeSettings({ tileTint: true, paperOpacity: 0.3, showWordCount: true, whatever: 1 });
  assert.deepEqual(Object.keys(s).sort(), Object.keys(defaultSettings()).sort());
});

test("migrations: views, backgrounds, surfaces, file size", () => {
  assert.equal(normalizeSettings({ defaultView: "masonry" }).defaultView, "grid");
  assert.equal(normalizeSettings({ defaultView: "tiles" }).defaultView, "grid");
  assert.equal(normalizeSettings({ paperStyle: "dots" }).background, "suns");
  assert.equal(normalizeSettings({ paperStyle: "blank" }).background, "plain");
  assert.equal(normalizeSettings({ backgroundPattern: true }).background, "suns");
  assert.equal(normalizeSettings({ cardSurface: "secondary" }).cardSurface, "flat");
  assert.equal(normalizeSettings({ cardSurface: "primary-alt" }).cardSurface, "elevated");
  assert.equal(normalizeSettings({ cardSurface: "transparent" }).cardSurface, "outline");
  assert.equal(normalizeSettings({ showWordCount: true }).showFileSize, true);
  assert.equal(normalizeSettings({ showWordCount: true, showFileSize: false }).showFileSize, false);
});

test("sections: legacy titles blank, legacy sources split, ids stay unique", () => {
  const s = normalizeSettings({
    sections: [
      { id: "x", kind: "recent-opened", title: "Recently opened" },
      { id: "x", kind: "unresolved", title: "Referenced but never written" },
      "not a section",
      { kind: "no-such-kind", title: "Mine" },
    ],
  });
  assert.deepEqual(
    s.sections.map((c) => [c.kind, c.title]),
    [["recent-opened", ""], ["most-linked", ""], ["least-linked", ""], ["recent-modified", "Mine"]]
  );
  const ids = s.sections.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.length > 0));
});

test("an empty section list falls back to the defaults", () => {
  assert.deepEqual(normalizeSettings({ sections: [] }).sections, defaultSettings().sections);
});

test("Les's live data.json survives intact", () => {
  const live = {
    greetingName: "Leslie", cardMinWidth: 260, cardSurface: "frosted", background: "regal",
    showGlyph: false, typifyIcons: false, showWordCount: false, dedupe: false, defaultView: "grid",
    openOnStartup: true,
    sections: [{ id: "o", kind: "property", propertyKey: "type", propertyValue: "Organization", title: "Organizations" }],
  };
  const s = normalizeSettings(live);
  assert.equal(s.greetingName, "Leslie");
  assert.equal(s.cardMinWidth, 260);
  assert.equal(s.cardSurface, "frosted");
  assert.equal(s.background, "regal");
  assert.equal(s.showGlyph, false);
  assert.equal(s.dedupe, false);
  assert.equal(s.openOnStartup, true);
  assert.equal(s.sections[0].title, "Organizations");
  assert.equal(s.sections[0].propertyValue, "Organization");
});
