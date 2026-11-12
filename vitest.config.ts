import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    exclude: ["web/**", "**/node_modules/**", "**/dist/**"],
  },
})
