import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
    // Tests are written against this launch day, whatever the real one is.
    env: { NEXT_PUBLIC_LAUNCH_DATE: "2026-11-15" },
  },
});
