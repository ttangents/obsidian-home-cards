import assert from "node:assert/strict";
import { test } from "node:test";
import { asStringList, firstValue, memoLast, parseDateLike, splitList } from "../src/compose/values";

test("asStringList keeps scalars and drops objects and nulls", () => {
  assert.deepEqual(asStringList("a"), ["a"]);
  assert.deepEqual(asStringList(3), ["3"]);
  assert.deepEqual(asStringList(["a", 2, true, null, { x: 1 }, ["n"]]), ["a", "2", "true"]);
  assert.deepEqual(asStringList(null), []);
  assert.deepEqual(asStringList({ a: 1 }), []);
  assert.equal(firstValue(undefined), "");
});

test("parseDateLike builds date-only strings in local time", () => {
  const d = parseDateLike("2026-08-03");
  assert.ok(d);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 3);
});

test("parseDateLike accepts ISO date-times and rejects everything else", () => {
  assert.ok(parseDateLike("2026-08-03T10:00:00"));
  assert.ok(parseDateLike("2026-08-03 10:00"));
  for (const raw of ["2024", "Report", "03/08/2026", "2026-8-3", ""]) {
    assert.equal(parseDateLike(raw), null, raw);
  }
});

test("splitList trims and drops empties", () => {
  assert.deepEqual(splitList(" a, ,b ,, c"), ["a", "b", "c"]);
  assert.deepEqual(splitList(""), []);
});

test("memoLast recomputes only when the input changes", () => {
  let calls = 0;
  const f = memoLast((s: string) => {
    calls++;
    return s.length;
  });
  f("ab");
  f("ab");
  assert.equal(calls, 1);
  f("abc");
  f("ab");
  assert.equal(calls, 3);
});
