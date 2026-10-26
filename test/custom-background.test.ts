import assert from "node:assert/strict";
import { test } from "vitest";
import {
  CUSTOM_BACKGROUNDS,
  isCustomId,
  isStoredFileName,
  labelFromFileName,
  newBackgroundId,
  selectedCustom,
  sniffImage,
  storedSize,
} from "../src/settings/custom-background";
import { normalizeCustomBackgrounds, normalizeSettings } from "../src/settings/normalize";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array<number>(16 - b.length).fill(0)]);

test("images are recognized by their first bytes, and SVG is refused", () => {
  assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47)), "png");
  assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)), "jpeg");
  assert.equal(sniffImage(bytes(0x47, 0x49, 0x46, 0x38)), "gif");
  const webp = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
  assert.equal(sniffImage(webp), "webp");
  const svg = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
  assert.equal(sniffImage(svg.slice(0, 16)), null);
  assert.equal(sniffImage(new Uint8Array(0)), null);
});

test("a pattern is capped by width and a picture by its longer side, never enlarged", () => {
  assert.deepEqual(storedSize(1600, 800, "pattern"), { width: 800, height: 400 });
  assert.deepEqual(storedSize(300, 300, "pattern"), { width: 300, height: 300 });
  assert.deepEqual(storedSize(4800, 2400, "picture"), { width: 2400, height: 1200 });
  assert.deepEqual(storedSize(1200, 6000, "picture"), { width: 480, height: 2400 });
  assert.deepEqual(storedSize(900, 600, "picture"), { width: 900, height: 600 });
});

test("a label starts from the file name", () => {
  assert.equal(labelFromFileName("autumn_leaves-2.jpg"), "autumn leaves 2");
  assert.equal(labelFromFileName(".png"), "Background");
  assert.equal(labelFromFileName("x".repeat(80) + ".png").length, CUSTOM_BACKGROUNDS.maxLabel);
});

test("generated ids and stored names pass their own checks", () => {
  const id = newBackgroundId();
  assert.ok(isCustomId(id));
  assert.ok(isStoredFileName(`${id}.webp`));
  assert.ok(!isCustomId("plain"));
  assert.ok(!isCustomId("custom-"));
});

const record = (over: Record<string, unknown> = {}) => ({
  id: "custom-abc1",
  label: "Dusk",
  file: "custom-abc1.webp",
  fit: "picture",
  width: 2000,
  fade: 60,
  ...over,
});

test("stored backgrounds are validated field by field", () => {
  const [bg] = normalizeCustomBackgrounds([record({ label: "  Dusk  ", fade: 500, width: 99999, fit: "weird" })]);
  assert.equal(bg.label, "Dusk");
  assert.equal(bg.fade, 95);
  assert.equal(bg.width, 2400);
  assert.equal(bg.fit, "pattern");
});

test("a stored file name can never leave the backgrounds folder", () => {
  for (const file of ["../x.webp", "a/b.webp", "..\\x.png", "x.svg", "x", "", ".webp"]) {
    assert.deepEqual(normalizeCustomBackgrounds([record({ file })]), [], file);
  }
  assert.deepEqual(normalizeCustomBackgrounds([record({ id: "../../etc" })]), []);
});

test("duplicates, junk and overflow are dropped", () => {
  assert.equal(normalizeCustomBackgrounds([record(), record(), "junk", null]).length, 1);
  const many = Array.from({ length: 20 }, (_, i) => record({ id: `custom-n${i}`, file: `custom-n${i}.webp` }));
  assert.equal(normalizeCustomBackgrounds(many).length, CUSTOM_BACKGROUNDS.max);
  assert.deepEqual(normalizeCustomBackgrounds(undefined), []);
});

test("the selected background must be built in or have a record", () => {
  const withRecord = normalizeSettings({ background: "custom-abc1", customBackgrounds: [record()] });
  assert.equal(withRecord.background, "custom-abc1");
  assert.equal(selectedCustom(withRecord)?.label, "Dusk");
  assert.equal(normalizeSettings({ background: "custom-abc1" }).background, "plain");
  assert.equal(normalizeSettings({ background: "leaves" }).background, "leaves");
  assert.equal(normalizeSettings({ background: "nonsense" }).background, "plain");
  assert.equal(selectedCustom(normalizeSettings({ background: "leaves" })), undefined);
});
