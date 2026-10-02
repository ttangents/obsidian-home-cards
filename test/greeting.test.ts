import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allListGreetings,
  cleanModelGreeting,
  greetingFor,
  greetingPrompt,
  withName,
} from "../src/compose/greeting";

const at = (month: number, day: number, hour: number) => new Date(2026, month - 1, day, hour);
/** Every greeting reachable at a moment, by sweeping the rng. */
const all = (d: Date, occasions = true) =>
  new Set(Array.from({ length: 800 }, (_, i) => greetingFor(d, { occasions, rng: () => i / 800 })));

test("occasions pin the greeting on the local date", () => {
  assert.ok([...all(at(12, 25, 9))].every((g) => /Christmas|Noël|Navidad|Natale|Season/.test(g)));
  assert.ok(all(at(5, 4, 20)).has("May the Fourth be with you"));
});

test("holiday greetings can be turned off", () => {
  const christmasMorning = all(at(12, 25, 9), false);
  assert.ok(christmasMorning.has("Good morning"));
  assert.ok(![...christmasMorning].some((g) => /Christmas|Noël|Navidad/.test(g)));
});

test("time of day chooses the lines", () => {
  assert.ok(all(at(8, 12, 9)).has("Good morning"));
  assert.ok(!all(at(8, 12, 9)).has("Good evening"));
  assert.ok(all(at(8, 12, 19)).has("Good evening"));
  assert.ok(all(at(8, 12, 2)).has("Still up, {name}?"));
  assert.ok(!all(at(8, 12, 2)).has("Good morning"));
  assert.ok(all(at(8, 12, 6)).has("Early start, {name}"));
});

test("weekdays and month starts add their own", () => {
  assert.ok(all(new Date(2026, 7, 14, 10)).has("Happy Friday"));
  assert.ok(all(new Date(2026, 7, 15, 10)).has("Happy Saturday"));
  assert.ok(!all(new Date(2026, 7, 12, 10)).has("Happy Friday"));
  assert.ok(all(new Date(2026, 9, 2, 10)).has("October already, {name}?"));
  assert.ok(!all(new Date(2026, 9, 12, 10)).has("October already, {name}?"));
});

test("every list greeting is short, Latin script, and uses only the name slot", () => {
  const latin = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}{}]+$/u;
  for (const g of allListGreetings()) {
    assert.match(g, latin, g);
    assert.ok(g.replace("{name}", "").length <= 40, `too long: ${g}`);
    assert.equal(g.replace("{name}", "").match(/[{}]/), null, g);
    assert.equal(g, g.trim(), g);
  }
});

test("withName fills, appends, or drops the name", () => {
  assert.equal(withName("Good morning", "Leslie"), "Good morning, Leslie");
  assert.equal(withName("Good morning", ""), "Good morning");
  assert.equal(withName("Still up, {name}?", "Leslie"), "Still up, Leslie?");
  assert.equal(withName("Still up, {name}?", " "), "Still up?");
  assert.equal(withName("Morning, {name}. Coffee in hand?", ""), "Morning. Coffee in hand?");
  assert.equal(withName("{name}, welcome back", ""), "welcome back");
  // Sentences stand alone.
  assert.equal(withName("Your notes missed you", "Leslie"), "Your notes missed you");
  assert.equal(withName("Happy Monday. Mostly.", "Leslie"), "Happy Monday. Mostly.");
});

test("the model prompt carries the moment and nothing else", () => {
  const p = greetingPrompt(new Date(2026, 11, 25, 7, 5), { occasions: true });
  assert.match(p, /Friday, 25 December, 07:05/);
  assert.match(p, /early morning/);
  assert.match(p, /Today is Christmas Day/);
  assert.doesNotMatch(greetingPrompt(new Date(2026, 11, 25, 7, 5), { occasions: false }), /Christmas/);
});

test("model replies are vetted before display", () => {
  assert.equal(cleanModelGreeting('"Rise and shine, {name}."\n'), "Rise and shine, {name}");
  assert.equal(cleanModelGreeting("Greeting: Hola, night owl!"), "Hola, night owl!");
  assert.equal(cleanModelGreeting("Here is your greeting: Coffee first"), "Coffee first");
  assert.equal(cleanModelGreeting("Well, well, well..."), "Well, well, well...");
  assert.equal(cleanModelGreeting("{ name }, it's Friday"), "{name}, it's Friday");
  for (const bad of ["", "   ", "Good morning 🌞", "नमस्ते", "Hello {user}", "x".repeat(70), "one two three four five six seven eight nine ten eleven"]) {
    assert.equal(cleanModelGreeting(bad), null, bad);
  }
});
