import assert from "node:assert/strict";
import { test } from "node:test";
import { GreetingSource, type LocalStore, type ModelRunner } from "../src/platform/greeting-source";
import { defaultSettings, type HomeCardsSettings } from "../src/settings/schema";

function memoryStore(): LocalStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    loadLocalStorage: (k: string) => data.get(k) ?? null,
    saveLocalStorage: (k: string, v: unknown) => void (v === null ? data.delete(k) : data.set(k, v)),
  };
}
function model(replies: (string | Error)[], supported = true): ModelRunner & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    supported: () => supported,
    run: async (_name, prompt) => {
      prompts.push(prompt);
      const next = replies.shift() ?? "Hello again";
      if (next instanceof Error) throw next;
      return next;
    },
  };
}
const settings = (over: Partial<HomeCardsSettings> = {}) => () => ({ ...defaultSettings(), greetingAI: true, ...over });
const morning = new Date(2026, 9, 2, 9, 0);

test("with AI off, or unsupported, the list answers and the model is never run", async () => {
  for (const [s, m] of [[settings({ greetingAI: false }), model([])], [settings(), model([], false)]] as const) {
    const src = new GreetingSource(memoryStore(), s, m);
    const picked = src.pick(morning);
    assert.equal(picked.later, null);
    assert.ok(picked.text.length > 0);
    await src.refill(morning);
    assert.equal(m.prompts.length, 0);
  }
});

test("a stored greeting for this slot shows once, then the next is written", async () => {
  const m = model(["Coffee first, {name}", "Second wind"]);
  const src = new GreetingSource(memoryStore(), settings(), m);
  await src.refill(morning);
  const first = src.pick(morning);
  assert.equal(first.text, "Coffee first, {name}");
  assert.equal(first.later, null);
  await src.refill(morning); // joins the refill pick started
  assert.equal(src.pick(morning).text, "Second wind");
});

test("a greeting written for the morning never shows in the evening", async () => {
  const src = new GreetingSource(memoryStore(), settings(), model(["Rise and shine"]));
  await src.refill(morning);
  const evening = src.pick(new Date(2026, 9, 2, 19, 0));
  assert.notEqual(evening.text, "Rise and shine");
  assert.ok(evening.later);
});

test("with nothing stored, the list shows now and the model's line arrives later", async () => {
  const src = new GreetingSource(memoryStore(), settings(), model(["Hola, early bird"]));
  const picked = src.pick(morning);
  assert.ok(picked.later);
  assert.equal(await picked.later, "Hola, early bird");
});

test("bad replies fall back; errors rest the source instead of retrying every open", async () => {
  const m = model(["Good morning 🌞", new Error("Shortcuts has no shortcut named x")]);
  const src = new GreetingSource(memoryStore(), settings(), m);
  assert.equal(await src.pick(morning).later, null); // emoji rejected
  const original = console.warn;
  console.warn = () => undefined;
  try {
    assert.equal(await src.pick(morning).later, null); // error
    const runs = m.prompts.length;
    await src.refill(morning);
    assert.equal(m.prompts.length, runs, "resting: no new run");
  } finally {
    console.warn = original;
  }
});

test("Test runs straight through and reports failure", async () => {
  const ok = new GreetingSource(memoryStore(), settings(), model(["Buongiorno, {name}"]));
  assert.equal(await ok.test(morning), "Buongiorno, {name}");
  const bad = new GreetingSource(memoryStore(), settings(), model([new Error("nope")]));
  await assert.rejects(bad.test(morning), /nope/);
});
