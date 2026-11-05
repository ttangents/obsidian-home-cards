/**
 * Home Cards' own API, version 1 (compose/provider.ts): the contract's
 * literals, which test/contract/home-cards-api.json pins and Pagewise's
 * copy of the same file must equal, the list `backgrounds()` returns, and
 * the handshake on a stand-in for the workspace's events in every order
 * the plugins can load and unload.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import type { EventRef } from "obsidian";
import type { EventBus } from "../src/compose/partner";
import {
  ApiProvider,
  cssSafeUrl,
  HOME_CARDS_API_VERSION,
  HOME_CARDS_EVENTS,
  imagesKey,
  listBackgrounds,
  type ApiBackground,
} from "../src/compose/provider";
import { BACKGROUNDS, PATTERN_VEILS } from "../src/settings/schema";

const contract = JSON.parse(readFileSync("test/contract/home-cards-api.json", "utf8")) as {
  version: number;
  events: Record<string, string>;
  methods: string[];
  background: string[];
};

/** The check Pagewise 0.39.0 applies to every image URL before it paints it. */
const PAGEWISE_IMAGE_URL = /^(?:data:image\/(?:webp|png|jpeg|gif|avif|svg\+xml);base64,[A-Za-z0-9+/=]+|app:\/\/[^\s"'()\\]+)$/;

class FakeBus implements EventBus {
  private readonly listeners: { name: string; callback: (...data: unknown[]) => unknown; ref: EventRef }[] = [];
  readonly fired: string[] = [];
  on(name: string, callback: (...data: unknown[]) => unknown): EventRef {
    const ref: EventRef = {};
    this.listeners.push({ name, callback, ref });
    return ref;
  }
  offref(ref: EventRef): void {
    const at = this.listeners.findIndex((l) => l.ref === ref);
    if (at >= 0) this.listeners.splice(at, 1);
  }
  trigger(name: string, ...data: unknown[]): void {
    this.fired.push(name);
    for (const l of [...this.listeners]) if (l.name === name) l.callback(...data);
  }
}

const SAMPLE: ApiBackground[] = [
  { id: "dots", label: "Dots", light: "data:image/webp;base64,AAAA", dark: "data:image/webp;base64,BBBB", veil: { light: 0.8, dark: 0.7 } },
];

/** Home Cards' plugin lifecycle around the provider, as main.ts runs it. */
function homeCards(bus: FakeBus, list: () => ApiBackground[] = () => SAMPLE) {
  const refs: EventRef[] = [];
  const provider = new ApiProvider(bus, list, () => {});
  return {
    provider,
    load() {
      provider.listen((ref) => refs.push(ref));
    },
    layoutReady() {
      provider.ready();
    },
    unload() {
      provider.unload();
      for (const ref of refs.splice(0)) bus.offref(ref);
    },
  };
}

/** A consumer in the shape of Pagewise's partners/homeCards.ts: listens first, then asks. */
function consumer(bus: FakeBus) {
  const seen = { api: null as { version: number; backgrounds(): ApiBackground[] } | null, readies: 0, changes: 0 };
  const refs: EventRef[] = [];
  return {
    seen,
    load() {
      refs.push(
        bus.on(HOME_CARDS_EVENTS.ready, (v1) => {
          seen.readies += 1;
          seen.api = v1 as typeof seen.api;
        }),
        bus.on(HOME_CARDS_EVENTS.unload, () => {
          seen.api = null;
        }),
        bus.on(HOME_CARDS_EVENTS.changed, () => {
          seen.changes += 1;
        })
      );
      bus.trigger(HOME_CARDS_EVENTS.request);
    },
    unload() {
      for (const ref of refs.splice(0)) bus.offref(ref);
    },
  };
}

test("the constants and the frozen API match the checked-in contract", () => {
  assert.equal(HOME_CARDS_API_VERSION, contract.version);
  assert.deepEqual(HOME_CARDS_EVENTS, contract.events);
  const { api } = new ApiProvider(new FakeBus(), () => SAMPLE);
  assert.ok(Object.isFrozen(api));
  assert.equal(api.version, contract.version);
  assert.deepEqual(Object.keys(api).filter((k) => k !== "version").sort(), [...contract.methods].sort());
  for (const name of contract.methods) assert.equal(typeof (api as unknown as Record<string, unknown>)[name], "function");
  for (const entry of api.backgrounds()) assert.deepEqual(Object.keys(entry).sort(), [...contract.background].sort());
});

test("the provider loads first: a consumer's request gets the API", () => {
  const bus = new FakeBus();
  const hc = homeCards(bus);
  hc.load();
  hc.layoutReady();
  const pw = consumer(bus);
  pw.load();
  assert.equal(pw.seen.api, hc.provider.api);
  assert.deepEqual(pw.seen.api?.backgrounds(), SAMPLE);
});

test("the consumer loads first: the API arrives when the layout is ready, and not before", () => {
  const bus = new FakeBus();
  const pw = consumer(bus);
  pw.load();
  const hc = homeCards(bus);
  hc.load();
  bus.trigger(HOME_CARDS_EVENTS.request);
  assert.equal(pw.seen.api, null, "no answer before the layout is ready");
  hc.layoutReady();
  assert.equal(pw.seen.api, hc.provider.api);
  hc.layoutReady();
  assert.equal(pw.seen.readies, 1, "ready is sent once, then only on request");
});

test("every ready carries the same object, so a consumer can skip re-registering", () => {
  const bus = new FakeBus();
  const hc = homeCards(bus);
  hc.load();
  hc.layoutReady();
  const pw = consumer(bus);
  pw.load();
  const first = pw.seen.api;
  bus.trigger(HOME_CARDS_EVENTS.request);
  assert.equal(pw.seen.readies, 2);
  assert.equal(pw.seen.api, first);
});

test("unload goes out first and leaves the API inert", () => {
  const bus = new FakeBus();
  const hc = homeCards(bus);
  hc.load();
  hc.layoutReady();
  const pw = consumer(bus);
  pw.load();
  const held = pw.seen.api;
  hc.unload();
  assert.equal(pw.seen.api, null);
  assert.deepEqual(held?.backgrounds(), [], "an API kept after unload lists nothing");
  const readies = pw.seen.readies;
  bus.trigger(HOME_CARDS_EVENTS.request);
  assert.equal(pw.seen.readies, readies, "no answer after unload");
  hc.provider.changed();
  assert.equal(pw.seen.changes, 0, "no change after unload");
  hc.unload();
  assert.equal(bus.fired.filter((n) => n === HOME_CARDS_EVENTS.unload).length, 1, "unload is said once");
  hc.layoutReady();
  assert.equal(pw.seen.readies, readies, "a late layout-ready after unload announces nothing");
});

test("a reloaded Home Cards announces a new object, and the consumer takes it", () => {
  const bus = new FakeBus();
  const pw = consumer(bus);
  pw.load();
  const first = homeCards(bus);
  first.load();
  first.layoutReady();
  const old = pw.seen.api;
  first.unload();
  const second = homeCards(bus);
  second.load();
  second.layoutReady();
  assert.ok(pw.seen.api);
  assert.notEqual(pw.seen.api, old);
  assert.equal(pw.seen.api, second.provider.api);
});

test("a reloaded consumer asks again and connects", () => {
  const bus = new FakeBus();
  const hc = homeCards(bus);
  hc.load();
  hc.layoutReady();
  const pw = consumer(bus);
  pw.load();
  pw.unload();
  const again = consumer(bus);
  again.load();
  assert.equal(again.seen.api, hc.provider.api);
});

test("changed reaches a connected consumer only while the API is live", () => {
  const bus = new FakeBus();
  const pw = consumer(bus);
  pw.load();
  const hc = homeCards(bus);
  hc.load();
  hc.provider.changed();
  assert.equal(pw.seen.changes, 0, "nothing before the layout is ready");
  hc.layoutReady();
  hc.provider.changed();
  assert.equal(pw.seen.changes, 1);
});

test("a failing list costs only the list", () => {
  const warnings: string[] = [];
  const provider = new ApiProvider(new FakeBus(), () => {
    throw new Error("boom");
  }, (message) => warnings.push(message));
  assert.deepEqual(provider.api.backgrounds(), []);
  assert.deepEqual(provider.api.backgrounds(), []);
  assert.equal(warnings.length, 1, "one warning");
});

test("backgrounds lists the patterns, then the images, as Pagewise reads them", () => {
  const list = listBackgrounds(
    [
      { id: "dots", label: "Dots", tiles: { light: "data:image/webp;base64,AA==", dark: "data:image/webp;base64,BB==" }, veil: { light: 86, dark: 85 } },
      { id: "lost", label: "Lost", tiles: undefined, veil: { light: 50, dark: 50 } },
      { id: "bare", label: "Bare", tiles: { light: "data:image/webp;base64,AA==", dark: "data:image/webp;base64,AA==" }, veil: undefined },
    ],
    [{ id: "custom-a1", label: "Desk", url: "app://abc/Users/me/Notes (work)/config/plugins/home-cards/backgrounds/custom-a1.webp?123", fade: 75 }]
  );
  assert.deepEqual(list.map((b) => b.id), ["dots", "custom-a1"]);
  assert.deepEqual(list[0]?.veil, { light: 0.86, dark: 0.85 });
  const image = list[1];
  assert.ok(image);
  assert.equal(image.light, image.dark);
  assert.equal(image.light, "app://abc/Users/me/Notes%20%28work%29/config/plugins/home-cards/backgrounds/custom-a1.webp?123");
  assert.deepEqual(image.veil, { light: 0.75, dark: 0.75 });
  for (const b of list) {
    assert.match(b.light, PAGEWISE_IMAGE_URL);
    assert.match(b.dark, PAGEWISE_IMAGE_URL);
  }
});

test("veils stay between 0 and 1, and URLs lose every character that ends a CSS value", () => {
  const [low, high] = listBackgrounds([], [
    { id: "custom-a", label: "A", url: "app://x/a", fade: -5 },
    { id: "custom-b", label: "B", url: "app://x/b", fade: 140 },
  ]);
  assert.deepEqual(low?.veil, { light: 0, dark: 0 });
  assert.deepEqual(high?.veil, { light: 1, dark: 1 });
  assert.equal(cssSafeUrl(`app://x/a "b" 'c' (d) \\e\tf`), "app://x/a%20%22b%22%20%27c%27%20%28d%29%20%5Ce%09f");
});

test("every built-in pattern has veils, in the picker's order, and the list follows the registry", async () => {
  const { TILES } = await import("../src/render/tiles.generated");
  const patterns = BACKGROUNDS.filter((b) => b.id !== "plain");
  const list = listBackgrounds(
    patterns.map((b) => ({ id: b.id, label: b.label, tiles: TILES[b.id], veil: PATTERN_VEILS[b.id] })),
    []
  );
  assert.deepEqual(list.map((b) => b.id), patterns.map((b) => b.id));
  assert.deepEqual(Object.keys(PATTERN_VEILS).sort(), patterns.map((b) => b.id).sort());
  for (const b of list) {
    assert.match(b.light, PAGEWISE_IMAGE_URL, `${b.id} light`);
    assert.match(b.dark, PAGEWISE_IMAGE_URL, `${b.id} dark`);
  }
});

test("the image key changes with what Pagewise shows, and only with it", () => {
  const a = { id: "custom-a", label: "A", file: "custom-a.webp", fade: 75, fit: "pattern", width: 400 };
  const wider = { ...a, width: 800 };
  assert.equal(imagesKey([a]), imagesKey([wider]));
  assert.notEqual(imagesKey([a]), imagesKey([{ ...a, label: "B" }]));
  assert.notEqual(imagesKey([a]), imagesKey([{ ...a, fade: 50 }]));
  assert.notEqual(imagesKey([a]), imagesKey([]));
});
