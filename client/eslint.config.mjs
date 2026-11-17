import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Components (many run in the browser) must not import the content data module: it bundles every JSON file,
    // including data that should stay on the server. Types are fine; helpers come from "@/lib/format".
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { paths: [{ name: "@/lib/content", message: "Import helpers from @/lib/format; only `import type` is allowed here.", allowTypeImports: true }] },
      ],
    },
  },
];

export default eslintConfig;
