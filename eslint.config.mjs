// Obsidian's own review rules, as the community directory applies them,
// over every file in the repository: the plugin, its manifest, its tests
// and its build scripts.
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

/** Proper nouns the sentence-case rule must leave capitalized. */
const BRANDS = [
  "Home Cards Greeting", "Home Cards", "Apple Intelligence", "Obsidian", "Mac", "Shortcuts",
  "Get Text from Input", "Shortcut Input", "Use Model", "On-Device", "Stop and Output", "Response",
  "Typify", "Bases", "Settings", "See more", "Christmas", "New Year's Day",
];

export default defineConfig([
  globalIgnores(["main.js", "styles.css", "node_modules/", "package-lock.json", "versions.json"]),
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ["manifest.json", "*.mjs", "scripts/*.mjs", "scripts/*.d.mts"] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "obsidianmd/ui/sentence-case": ["error", { brands: BRANDS, enforceCamelCaseLower: true }],
    },
  },
  // Tests and build scripts run in Node, never in Obsidian: Node's modules
  // and globals are theirs to use, and the scripts report to the console.
  {
    files: ["test/**/*.ts", "scripts/**/*.mjs", "*.mjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
      "no-console": "off",
      "obsidianmd/rule-custom-message": "off",
    },
  },
  // The fake vault builds plain objects in the shape of Obsidian's files,
  // which only a cast can pass where a TFile is expected.
  {
    files: ["test/fake-vault.ts"],
    rules: { "obsidianmd/no-tfile-tfolder-cast": "off" },
  },
]);
