import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } }, // so .tsx files work without importing React
  resolve: { alias: { "@": path.resolve(__dirname, "src") } }, // the same "@/..." imports as the website
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
