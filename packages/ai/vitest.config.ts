import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@renaiss/core": new URL("../core/src/index.ts", import.meta.url).pathname
    }
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"]
  }
});
