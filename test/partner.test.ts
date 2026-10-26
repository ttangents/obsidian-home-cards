/**
 * The handshake with Relate and Pagewise: the event names both sides agree
 * on, and the connection over a stand-in for the workspace's events in
 * every order the plugins can load and unload.
 */

import assert from "node:assert/strict";
import { test } from "vitest";
import type { EventRef } from "obsidian";
import { asPagewiseApi, PAGEWISE_CONTRACT, PAGEWISE_EVENTS, type PagewiseApi } from "../src/compose/pagewise";
import { connectPartner, type EventBus, type PartnerState } from "../src/compose/partner";
import { asRelateApi, RELATE_CONTRACT, RELATE_EVENTS, type RelateApi } from "../src/compose/relate";

test("the event names match the partners' published contracts", () => {
  assert.deepEqual(RELATE_EVENTS, {
    ready: "relate:ready",
    request: "relate:request",
    unload: "relate:unload",
    changed: "relate:changed",
  });
  assert.deepEqual(PAGEWISE_EVENTS, {
    ready: "pagewise:ready",
    request: "pagewise:request",
    unload: "pagewise:unload",
  });
  assert.equal(RELATE_CONTRACT, 1);
  assert.equal(PAGEWISE_CONTRACT, 1);
});

/** Obsidian's Events, as far as the handshake uses them, with a way to drop every listener of one owner. */
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

/** A provider in the shape the Vibes standard sets: ready on load and on request, unload first in onunload. */
function provider(bus: FakeBus, id: string, api: object) {
  let ref: EventRef | null = null;
  return {
    load() {
      ref = bus.on(`${id}:request`, () => bus.trigger(`${id}:ready`, api));
      bus.trigger(`${id}:ready`, api);
    },
    unload() {
      bus.trigger(`${id}:unload`);
      if (ref) bus.offref(ref);
      ref = null;
    },
  };
}

/** Home Cards' side: connects on load and keeps every state it is told. */
function consumer<Api>(bus: FakeBus, events: typeof RELATE_EVENTS | typeof PAGEWISE_EVENTS, accept: (v: unknown) => Api | null) {
  const states: PartnerState<Api>[] = [];
  const warnings: string[] = [];
  const refs: EventRef[] = [];
  let changes = 0;
  return {
    states,
    warnings,
    changes: () => changes,
    load() {
      return connectPartner(bus, {
        name: "Partner",
        events,
        accept,
        register: (ref) => refs.push(ref),
        warn: (message) => warnings.push(message),
        onState: (state) => states.push(state),
        onChanged: () => changes++,
      });
    },
    unload() {
      for (const ref of refs.splice(0)) bus.offref(ref);
    },
  };
}

const relateApi = (version = 1): RelateApi & object =>
  Object.freeze({
    version,
    search: () => Promise.resolve([]),
    connections: () => [],
    similar: () => [],
    meaningReady: () => true,
  });
const pagewiseApi = (version = 1): PagewiseApi & object =>
  Object.freeze({ version, registerToolbarItem: () => () => undefined, refreshToolbar: () => undefined });

const kinds = <Api>(states: PartnerState<Api>[]) => states.map((s) => s.kind);

for (const [label, events, accept, make] of [
  ["Relate", RELATE_EVENTS, asRelateApi, relateApi],
  ["Pagewise", PAGEWISE_EVENTS, asPagewiseApi, pagewiseApi],
] as const) {
  const id = events.ready.split(":")[0];

  test(`${label}: connects when the provider loads first`, () => {
    const bus = new FakeBus();
    const api = make();
    provider(bus, id, api).load();
    const home = consumer<object>(bus, events, accept);
    const state = home.load();
    assert.deepEqual(kinds(home.states), ["present"]);
    assert.equal(state().kind, "present");
    assert.ok(bus.fired.includes(events.request));
  });

  test(`${label}: connects when Home Cards loads first`, () => {
    const bus = new FakeBus();
    const home = consumer<object>(bus, events, accept);
    const state = home.load();
    assert.equal(state().kind, "absent");
    assert.deepEqual(home.states, []);
    provider(bus, id, make()).load();
    assert.deepEqual(kinds(home.states), ["present"]);
  });

  test(`${label}: unload drops the API, and a reload brings it back`, () => {
    const bus = new FakeBus();
    const partner = provider(bus, id, make());
    partner.load();
    const home = consumer<object>(bus, events, accept);
    const state = home.load();
    partner.unload();
    assert.equal(state().kind, "absent");
    const again = make();
    const reloaded = provider(bus, id, again);
    reloaded.load();
    const now = state();
    assert.equal(now.kind === "present" && now.api, again);
    assert.deepEqual(kinds(home.states), ["present", "absent", "present"]);
  });

  test(`${label}: the same API announced again changes nothing`, () => {
    const bus = new FakeBus();
    const partner = provider(bus, id, make());
    partner.load();
    const home = consumer<object>(bus, events, accept);
    home.load();
    // Another consumer's request makes the provider announce to everyone.
    bus.trigger(events.request);
    bus.trigger(events.request);
    assert.deepEqual(kinds(home.states), ["present"]);
  });

  test(`${label}: an unknown version is present but incompatible, logged once`, () => {
    const bus = new FakeBus();
    const partner = provider(bus, id, make(2));
    partner.load();
    const home = consumer<object>(bus, events, accept);
    const state = home.load();
    assert.deepEqual(state(), { kind: "incompatible", version: 2 });
    bus.trigger(events.request);
    assert.equal(home.states.length, 1);
    assert.equal(home.warnings.length, 1);
    assert.match(home.warnings[0], /version 2/);
    // A provider that serves version 2 beside version 1 still connects.
    bus.trigger(events.ready, make(1), make(2));
    assert.equal(state().kind, "present");
    // One that dropped version 1 passes null in its place.
    bus.trigger(events.ready, null, make(2));
    assert.deepEqual(state(), { kind: "incompatible", version: 2 });
    assert.equal(home.warnings.length, 1);
  });

  test(`${label}: Home Cards' unload releases its listeners`, () => {
    const bus = new FakeBus();
    const home = consumer<object>(bus, events, accept);
    home.load();
    home.unload();
    provider(bus, id, make()).load();
    assert.deepEqual(home.states, []);
  });
}

test("Relate's changes count only while Relate is present", () => {
  const bus = new FakeBus();
  const home = consumer<object>(bus, RELATE_EVENTS, asRelateApi);
  home.load();
  bus.trigger(RELATE_EVENTS.changed);
  assert.equal(home.changes(), 0);
  provider(bus, "relate", relateApi()).load();
  bus.trigger(RELATE_EVENTS.changed, { path: "Note.md" });
  assert.equal(home.changes(), 1);
});
