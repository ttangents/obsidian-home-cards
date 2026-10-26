/**
 * Vitest runs the suite in Node. The `obsidian` package ships types only,
 * so the layers under test import it for types alone; see
 * test/architecture.test.ts.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
