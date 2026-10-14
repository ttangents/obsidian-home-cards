/**
 * node:test's `test`, returning nothing. The runner awaits every test it
 * registers, so the promise `test` returns carries nothing the suite
 * needs; dropping it here keeps each file free of `void test(...)`.
 */

import { test as nodeTest } from "node:test";

export function test(name: string, fn: () => void | Promise<void>): void {
  void nodeTest(name, fn);
}
