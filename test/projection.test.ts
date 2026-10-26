import assert from "node:assert/strict";
import { test } from "vitest";
import { buildCard, type CardContext } from "../src/compose/card";
import { imageLink, imageLinkFor } from "../src/compose/images";
import { displayText, formatField, projectFields, relativeDay } from "../src/compose/projection";
import { VaultSnapshot } from "../src/compose/vault";
import { normalizeSettings } from "../src/settings/normalize";
import { defaultSettings } from "../src/settings/schema";
import { fakeVault } from "./fake-vault";

/** Saturday 17 October 2026, 14:30 local time. */
const NOW = new Date(2026, 9, 17, 14, 30);

test("days read in words from the reader's today", () => {
  assert.equal(relativeDay(new Date(2026, 9, 17, 23, 0), NOW), "today");
  assert.equal(relativeDay(new Date(2026, 9, 18), NOW), "tomorrow");
  assert.equal(relativeDay(new Date(2026, 9, 16), NOW), "yesterday");
  assert.equal(relativeDay(new Date(2026, 9, 23), NOW), new Date(2026, 9, 23).toLocaleDateString(undefined, { weekday: "long" }));
  assert.equal(relativeDay(new Date(2026, 9, 14), NOW), "3 days ago");
  assert.ok(!/2026/.test(relativeDay(new Date(2026, 0, 2), NOW)), "this year's dates leave the year out");
  assert.match(relativeDay(new Date(2025, 0, 2), NOW), /2025/);
});

test("fields read by the kind of value, not by the property's name", () => {
  assert.equal(formatField("status", "Active", NOW), "Active");
  assert.equal(formatField("owner", "[[People/Leslie Joseph|Les]]", NOW), "Les");
  assert.equal(formatField("owner", "[[People/Jane Smith]]", NOW), "Jane Smith");
  assert.equal(formatField("due", "2026-10-18", NOW), "Due tomorrow");
  assert.equal(formatField("rating", 5, NOW), "Rating 5");
  assert.equal(formatField("read", true, NOW), "Read");
  assert.equal(formatField("read", false, NOW), "");
  assert.equal(formatField("topics", ["a", "b", "c", "d", "e"], NOW), "a, b, c +2");
  assert.equal(formatField("x", "", NOW), "");
  assert.equal(formatField("x", { nested: 1 }, NOW), "");
  assert.equal(formatField("file.ctime", new Date(2026, 9, 14), NOW), "Created 3 days ago");
  assert.equal(displayText("plain"), "plain");
});

test("image links come from vault paths and links only", () => {
  assert.equal(imageLink("[[covers/deutsch.jpg]]"), "covers/deutsch.jpg");
  assert.equal(imageLink("![[deutsch.jpg|200]]"), "deutsch.jpg");
  assert.equal(imageLink("![](attachments/My%20Cover.png)"), "attachments/My Cover.png");
  assert.equal(imageLink("covers/deutsch.webp"), "covers/deutsch.webp");
  assert.equal(imageLink(["a.png", "b.png"]), "a.png");
  assert.equal(imageLink("https://example.com/a.png"), null, "a web address would be a network request");
  assert.equal(imageLink("data:image/png;base64,AAAA"), null);
  assert.equal(imageLink("[[Some note]]"), null);
  assert.equal(imageLink(4), null);
});

const v = fakeVault(
  [
    { path: "Books/Infinity.md", fm: { cover: "[[deutsch.jpg]]", author: "David Deutsch", rating: 5, status: "Reading" } },
    { path: "Books/Embed.md", fm: { image: "https://example.com/x.png" }, embeds: ["photo.png", "Other note"] },
    { path: "Books/Plain.md", fm: { author: "Anon" } },
    { path: "Books/Broken.md", fm: { cover: "[[missing.png]]" } },
  ],
  { attachments: ["Covers/deutsch.jpg", "photo.png"] }
);

test("a card's image follows the configured properties, then the first embedded image", () => {
  const cacheOf = (p: string) => v.app.metadataCache.getFileCache(v.file(p));
  assert.equal(imageLinkFor(cacheOf("Books/Infinity.md"), "cover, image"), "deutsch.jpg");
  assert.equal(imageLinkFor(cacheOf("Books/Embed.md"), "cover, image"), "photo.png", "the web address is passed over");
  assert.equal(imageLinkFor(cacheOf("Books/Plain.md"), "cover, image"), null);
  assert.equal(imageLinkFor(cacheOf("Books/Infinity.md"), "image"), null, "only the configured properties count");
  const snap = new VaultSnapshot(v.app, NOW);
  assert.equal(snap.imageUrl(v.file("Books/Infinity.md"), cacheOf("Books/Infinity.md"), "cover"), "app://vault/Covers/deutsch.jpg");
  assert.equal(snap.imageUrl(v.file("Books/Broken.md"), cacheOf("Books/Broken.md"), "cover"), null, "a link to nothing shows nothing");
});

test("a section's fields and image shape its cards; without them the footer stays as it was", async () => {
  const settings = defaultSettings();
  const snap = new VaultSnapshot(v.app, NOW);
  const ctx: CardContext = {
    settings,
    cacheOf: (f) => snap.cacheOf(f),
    now: NOW,
    metaKey: "date",
    fields: ["author", "rating", "status"],
    image: "cover",
    imageUrl: (f, cache) => snap.imageUrl(f, cache, settings.imageProperties),
    icons: new Map(),
  };
  const book = await buildCard(ctx, v.file("Books/Infinity.md"), "Opened yesterday");
  assert.equal(book.meta, "Opened yesterday · David Deutsch · Rating 5 · Reading");
  assert.equal(book.image, "app://vault/Covers/deutsch.jpg");
  assert.equal(book.imageMode, "cover");
  assert.match(book.search, /david deutsch/);
  const plain = await buildCard({ ...ctx, image: "thumbnail" }, v.file("Books/Plain.md"));
  assert.equal(plain.image, null);
  assert.equal(plain.imageMode, "none", "a card without an image shows none, whatever the section asks");
  assert.equal(plain.imageSlot, "thumbnail", "it still keeps the section's image place, for a tile");
  const old = await buildCard({ ...ctx, fields: [], image: "none" }, v.file("Books/Infinity.md"));
  assert.equal(old.meta, "");
  assert.equal(old.image, null);
  assert.equal(old.imageSlot, "none");
  assert.deepEqual(projectFields(v.file("Books/Plain.md"), snap.cacheOf(v.file("Books/Plain.md")), ["author", "missing"], NOW), ["Anon"]);
});

test("stored fields and image modes are cleaned", () => {
  const s = normalizeSettings({
    sections: [{ id: "a", kind: "recent-created", fields: [" author ", "author", 4, "", "rating", "status", "extra"], image: "cover" }, { id: "b", image: "huge" }],
  });
  assert.deepEqual(s.sections[0].fields, ["author", "rating", "status"]);
  assert.equal(s.sections[0].image, "cover");
  assert.equal(s.sections[1].image, "none");
  assert.equal(s.imageProperties, "cover, image");
});
