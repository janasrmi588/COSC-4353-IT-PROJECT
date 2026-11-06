import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",

      include: [
        "src/modules/**/*.service.js",
        "src/data/store.js",
        "src/models/**/*.js",
        "src/db/**/*.js",
      ],

      reporter: ["text", "html"],
    },
  },
});