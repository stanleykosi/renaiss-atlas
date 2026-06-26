import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "pnpm-lock.yaml"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          "allowBoolean": true,
          "allowNumber": true,
          "allowNullish": true
        }
      ]
    }
  },
  {
    files: ["**/*.config.{js,mjs,cjs,ts}", "eslint.config.mjs"],
    ...tseslint.configs.disableTypeChecked
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts", "**/tests/**/*.ts"],
    ...tseslint.configs.disableTypeChecked
  },
  {
    files: ["**/next-env.d.ts"],
    rules: {
      "@typescript-eslint/triple-slash-reference": "off"
    }
  },
  prettier
];
