import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    ignores: ["node_modules/", "main.js"],
  },
  {
    files: ["**/*.ts"],
    plugins: {
      "@eslint-community/eslint-comments": eslintComments,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        // Browser globals
        document: "readonly",
        window: "readonly",
        console: "readonly",
      },
    },
    rules: {
      // Directive comment rules (match PR checker)
      "@eslint-community/eslint-comments/require-description": "error",
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        "@typescript-eslint/no-explicit-any",
      ],
      // TypeScript rules (match PR checker)
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/require-await": "error",
    },
  },
]);
