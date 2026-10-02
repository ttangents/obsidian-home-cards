// Obsidian's own review rules, as the community directory applies them.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "node_modules/", "test/", "scripts/", "*.mjs"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "error",
        { brands: ["Home Cards Greeting", "Home Cards", "Apple Intelligence", "Obsidian", "Mac", "Shortcuts", "Typify", "Bases", "Settings", "Christmas", "New Year's Day"], enforceCamelCaseLower: true },
      ],
    },
  },
]);
