import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", exclude: ["tests/e2e/**", "node_modules/**", ".next/**", ".syntax/**"], coverage: { reporter: ["text", "html"] } },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
