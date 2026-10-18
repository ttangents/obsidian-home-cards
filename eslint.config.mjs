// Obsidian's own review rules, as the community directory applies them,
// over every file in the repository: the plugin, its manifest, its tests
// and its build scripts.
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

/** Proper nouns the sentence-case rule must leave capitalized. */
const BRANDS = [
  "Home Cards", "Obsidian", "Typify", "Bases", "Settings", "See more", "New Year's Day",
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
      // Home Cards' platform rules (see ARCHITECTURE.md). Each of these is a
      // way to reach past Obsidian's public API or past the type checker.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true }],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='document'][property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]",
          message: "Query only Home Cards' own elements, from an element Home Cards created.",
        },
        {
          selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
          message: "A double cast hides a type error; reach for a public API or a type guard instead.",
        },
        {
          selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
          message: "Casting to any switches the type checker off.",
        },
      ],
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
