import assert from "node:assert/strict";
import { test } from "node:test";
import { greetingFor } from "../src/compose/greeting";

const at = (month: number, day: number, hour: number) => new Date(2026, month - 1, day, hour);
/** Every greeting reachable at a moment, by sweeping the rng. */
const all = (d: Date) => new Set(Array.from({ length: 400 }, (_, i) => greetingFor(d, () => i / 400)));

test("occasions pin the greeting on the local date", () => {
  assert.ok([...all(at(12, 25, 9))].every((g) => /Christmas|Noël|Navidad/.test(g)));
  assert.ok(all(at(5, 4, 20)).has("May the Fourth be with you"));
});

test("time of day chooses the bucket", () => {
  assert.ok(all(at(8, 12, 8)).has("Good morning"));
  assert.ok(!all(at(8, 12, 8)).has("Good evening"));
  assert.ok(all(at(8, 12, 19)).has("Good evening"));
  assert.ok(all(at(8, 12, 2)).has("Still up"));
  assert.ok(!all(at(8, 12, 2)).has("Good morning"));
});

test("Fridays and weekends add their own", () => {
  assert.ok(all(new Date(2026, 7, 14, 10)).has("Happy Friday"));
  assert.ok(all(new Date(2026, 7, 15, 10)).has("Happy weekend"));
  assert.ok(!all(new Date(2026, 7, 12, 10)).has("Happy Friday"));
});

test("every greeting, all year round, is in Latin script", () => {
  const latin = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}]+$/u;
  for (let m = 1; m <= 12; m++) {
    for (const day of [1, 4, 14, 17, 24, 25, 31]) {
      for (const hour of [2, 8, 14, 19]) {
        for (const g of all(new Date(2026, m - 1, day, hour))) assert.match(g, latin, g);
      }
    }
  }
});

test("the rng's upper edge stays in range", () => {
  assert.equal(typeof greetingFor(at(8, 12, 8), () => 0.9999999), "string");
});
